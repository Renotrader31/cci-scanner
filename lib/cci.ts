import { Bar } from './polygon';

export type DivergenceType = 
  | 'REG_BULL' 
  | 'REG_BEAR' 
  | 'HID_BULL' 
  | 'HID_BEAR' 
  | 'BREW_BULL' 
  | 'BREW_BEAR';

export interface Divergence {
  type: DivergenceType;
  strength: number;
  quality: 'STRONG' | 'MODERATE' | 'WEAK';
  cciValue: number;
  price: number;
  timestamp: number;
  volumeConfirmed: boolean;
  momentumConfirmed: boolean;
}

export interface ScanResult {
  symbol: string;
  price: number;
  cci: number;
  momentum: number;
  zone: string;
  divergences: Divergence[];
  timestamp: Date;
}

// Calculate Simple Moving Average
function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

// Calculate EMA
function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[i]);
    } else if (isNaN(result[i - 1])) {
      result.push(values[i]);
    } else {
      result.push((values[i] - result[i - 1]) * multiplier + result[i - 1]);
    }
  }
  return result;
}

// Calculate Mean Deviation
function meanDeviation(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const deviation = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
      result.push(deviation);
    }
  }
  return result;
}

// Calculate CCI
export function calculateCCI(
  bars: Bar[],
  period: number = 20,
  smoothing: number = 5
): { cci: number[]; momentum: number[]; volume: number[]; avgVolume: number[] } {
  // Calculate typical price (HLC3)
  const hlc3 = bars.map(b => (b.h + b.l + b.c) / 3);
  const volume = bars.map(b => b.v);
  
  // SMA of typical price
  const tpSma = sma(hlc3, period);
  
  // Mean deviation
  const meanDev = meanDeviation(hlc3, period);
  
  // Raw CCI
  const rawCCI = hlc3.map((tp, i) => {
    if (isNaN(tpSma[i]) || isNaN(meanDev[i]) || meanDev[i] === 0) {
      return NaN;
    }
    return (tp - tpSma[i]) / (0.015 * meanDev[i]);
  });
  
  // Smoothed CCI (double EMA)
  const cci1 = ema(rawCCI, smoothing);
  const cci = ema(cci1, 2);
  
  // Momentum (change in CCI)
  const momentum = cci.map((val, i) => {
    if (i === 0 || isNaN(val) || isNaN(cci[i - 1])) return NaN;
    return val - cci[i - 1];
  });
  
  // Average volume
  const avgVolume = sma(volume, 20);
  
  return { cci, momentum, volume, avgVolume };
}

// Find pivot points
function findPivots(
  values: number[],
  lookbackLeft: number = 5,
  lookbackRight: number = 5
): { lows: number[]; highs: number[] } {
  const lows: number[] = [];
  const highs: number[] = [];
  
  for (let i = lookbackLeft; i < values.length - lookbackRight; i++) {
    if (isNaN(values[i])) continue;
    
    let isLow = true;
    let isHigh = true;
    
    for (let j = 1; j <= lookbackLeft; j++) {
      if (isNaN(values[i - j]) || values[i] > values[i - j]) isLow = false;
      if (isNaN(values[i - j]) || values[i] < values[i - j]) isHigh = false;
    }
    
    for (let j = 1; j <= lookbackRight; j++) {
      if (isNaN(values[i + j]) || values[i] > values[i + j]) isLow = false;
      if (isNaN(values[i + j]) || values[i] < values[i + j]) isHigh = false;
    }
    
    if (isLow) lows.push(i);
    if (isHigh) highs.push(i);
  }
  
  return { lows, highs };
}

// Calculate divergence strength
function calcStrength(
  priceDiff: number,
  cciDiff: number,
  isExtreme: boolean,
  highVolume: boolean,
  momentumConfirm: boolean
): number {
  const priceScore = Math.min(3.0, Math.abs(priceDiff) * 100);
  const cciScore = Math.min(3.0, Math.abs(cciDiff) / 30);
  
  const extremeBonus = isExtreme ? 1.5 : 0;
  const volumeBonus = highVolume ? 1.0 : 0;
  const momentumBonus = momentumConfirm ? 1.0 : 0;
  
  return Math.min(10, priceScore + cciScore + extremeBonus + volumeBonus + momentumBonus);
}

function getQuality(strength: number): 'STRONG' | 'MODERATE' | 'WEAK' {
  if (strength >= 7) return 'STRONG';
  if (strength >= 5) return 'MODERATE';
  return 'WEAK';
}

// Detect divergences
export function detectDivergences(
  bars: Bar[],
  cci: number[],
  momentum: number[],
  volume: number[],
  avgVolume: number[],
  minStrength: number = 3.0
): Divergence[] {
  const divergences: Divergence[] = [];
  const lookbackLeft = 5;
  const lookbackRight = 5;
  
  const { lows: cciLows, highs: cciHighs } = findPivots(cci, lookbackLeft, lookbackRight);
  
  // Process pivot lows for bullish divergences
  for (let i = 1; i < cciLows.length; i++) {
    const currIdx = cciLows[i];
    const prevIdx = cciLows[i - 1];
    
    const barDiff = currIdx - prevIdx;
    if (barDiff < 5 || barDiff > 60) continue;
    
    const currCCI = cci[currIdx];
    const prevCCI = cci[prevIdx];
    const currPrice = bars[currIdx].l;
    const prevPrice = bars[prevIdx].l;
    
    const isExtreme = currCCI < -100;
    const highVol = volume[currIdx] > avgVolume[currIdx] * 1.2;
    const momConfirm = momentum[currIdx] > 0;
    
    // Regular Bullish: Price Lower Low, CCI Higher Low
    if (currPrice < prevPrice && currCCI > prevCCI) {
      const strength = calcStrength(
        (currPrice - prevPrice) / prevPrice,
        currCCI - prevCCI,
        isExtreme,
        highVol,
        momConfirm
      );
      
      if (strength >= minStrength) {
        divergences.push({
          type: 'REG_BULL',
          strength,
          quality: getQuality(strength),
          cciValue: currCCI,
          price: currPrice,
          timestamp: bars[currIdx].t,
          volumeConfirmed: highVol,
          momentumConfirmed: momConfirm
        });
      }
    }
    
    // Hidden Bullish: Price Higher Low, CCI Lower Low
    if (currPrice > prevPrice && currCCI < prevCCI) {
      const strength = calcStrength(
        (currPrice - prevPrice) / prevPrice,
        prevCCI - currCCI,
        isExtreme,
        highVol,
        momConfirm
      );
      
      if (strength >= minStrength) {
        divergences.push({
          type: 'HID_BULL',
          strength,
          quality: getQuality(strength),
          cciValue: currCCI,
          price: currPrice,
          timestamp: bars[currIdx].t,
          volumeConfirmed: highVol,
          momentumConfirmed: momConfirm
        });
      }
    }
  }
  
  // Process pivot highs for bearish divergences
  for (let i = 1; i < cciHighs.length; i++) {
    const currIdx = cciHighs[i];
    const prevIdx = cciHighs[i - 1];
    
    const barDiff = currIdx - prevIdx;
    if (barDiff < 5 || barDiff > 60) continue;
    
    const currCCI = cci[currIdx];
    const prevCCI = cci[prevIdx];
    const currPrice = bars[currIdx].h;
    const prevPrice = bars[prevIdx].h;
    
    const isExtreme = currCCI > 100;
    const highVol = volume[currIdx] > avgVolume[currIdx] * 1.2;
    const momConfirm = momentum[currIdx] < 0;
    
    // Regular Bearish: Price Higher High, CCI Lower High
    if (currPrice > prevPrice && currCCI < prevCCI) {
      const strength = calcStrength(
        (currPrice - prevPrice) / prevPrice,
        prevCCI - currCCI,
        isExtreme,
        highVol,
        momConfirm
      );
      
      if (strength >= minStrength) {
        divergences.push({
          type: 'REG_BEAR',
          strength,
          quality: getQuality(strength),
          cciValue: currCCI,
          price: currPrice,
          timestamp: bars[currIdx].t,
          volumeConfirmed: highVol,
          momentumConfirmed: momConfirm
        });
      }
    }
    
    // Hidden Bearish: Price Lower High, CCI Higher High
    if (currPrice < prevPrice && currCCI > prevCCI) {
      const strength = calcStrength(
        (prevPrice - currPrice) / prevPrice,
        currCCI - prevCCI,
        isExtreme,
        highVol,
        momConfirm
      );
      
      if (strength >= minStrength) {
        divergences.push({
          type: 'HID_BEAR',
          strength,
          quality: getQuality(strength),
          cciValue: currCCI,
          price: currPrice,
          timestamp: bars[currIdx].t,
          volumeConfirmed: highVol,
          momentumConfirmed: momConfirm
        });
      }
    }
  }
  
  // Filter to recent divergences only (within last 15 bars)
  const recentBarIdx = bars.length - 15;
  const recentTimestamp = bars[Math.max(0, recentBarIdx)]?.t || 0;
  
  return divergences.filter(d => d.timestamp >= recentTimestamp);
}

// Get CCI zone description
export function getCCIZone(cci: number): string {
  if (cci > 200) return 'EXTREME OB';
  if (cci > 100) return 'Overbought';
  if (cci < -200) return 'EXTREME OS';
  if (cci < -100) return 'Oversold';
  return 'Neutral';
}
