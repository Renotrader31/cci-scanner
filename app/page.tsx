'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, RefreshCw, Settings, 
  CheckCircle, XCircle, Clock, Zap, AlertTriangle
} from 'lucide-react';
import { getAggregates } from '@/lib/polygon';
import { calculateCCI, detectDivergences, getCCIZone, ScanResult, Divergence } from '@/lib/cci';

const DEFAULT_WATCHLIST = [
  'SPY', 'QQQ', 'IWM', 'DIA',
  'TQQQ', 'SQQQ',
  'NVDA', 'AMD', 'TSLA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN',
  'XLF', 'XLE', 'XLK',
];

type TimeframeOption = '5' | '15' | '60';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [signals, setSignals] = useState<(Divergence & { symbol: string })[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [timeframe, setTimeframe] = useState<TimeframeOption>('5');
  const [minStrength, setMinStrength] = useState(3);
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST.join(', '));
  const [showSettings, setShowSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('polygon_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setIsConfigured(true);
    }
  }, []);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || !isConfigured) return;
    
    const interval = setInterval(() => {
      runScan();
    }, 60000); // Every 60 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, isConfigured, timeframe, minStrength, watchlist]);

  const saveApiKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('polygon_api_key', apiKeyInput.trim());
      setApiKey(apiKeyInput.trim());
      setIsConfigured(true);
    }
  };

  const runScan = useCallback(async () => {
    if (!apiKey) return;
    
    setIsScanning(true);
    setResults([]);
    setSignals([]);
    
    const symbols = watchlist.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    setProgress({ current: 0, total: symbols.length });
    
    const newResults: ScanResult[] = [];
    const newSignals: (Divergence & { symbol: string })[] = [];
    
    const multiplier = parseInt(timeframe);
    
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      setProgress({ current: i + 1, total: symbols.length });
      
      try {
        const bars = await getAggregates(symbol, apiKey, multiplier, 'minute');
        
        if (bars.length < 50) {
          continue;
        }
        
        const { cci, momentum, volume, avgVolume } = calculateCCI(bars);
        const divergences = detectDivergences(bars, cci, momentum, volume, avgVolume, minStrength);
        
        const lastIdx = bars.length - 1;
        const currentCCI = cci[lastIdx];
        const currentMomentum = momentum[lastIdx];
        
        const result: ScanResult = {
          symbol,
          price: bars[lastIdx].c,
          cci: currentCCI,
          momentum: currentMomentum,
          zone: getCCIZone(currentCCI),
          divergences,
          timestamp: new Date()
        };
        
        newResults.push(result);
        
        // Add signals with symbol
        divergences.forEach(d => {
          newSignals.push({ ...d, symbol });
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`Error scanning ${symbol}:`, error);
      }
    }
    
    // Sort signals by strength
    newSignals.sort((a, b) => b.strength - a.strength);
    
    setResults(newResults);
    setSignals(newSignals);
    setLastScan(new Date());
    setIsScanning(false);
  }, [apiKey, timeframe, minStrength, watchlist]);

  const getTypeColor = (type: string) => {
    if (type.includes('BULL')) return 'text-green-400';
    if (type.includes('BEAR')) return 'text-red-400';
    return 'text-gray-400';
  };

  const getTypeBg = (type: string) => {
    if (type.includes('BULL')) return 'bg-green-500/20 border-green-500/30';
    if (type.includes('BEAR')) return 'bg-red-500/20 border-red-500/30';
    return 'bg-gray-500/20 border-gray-500/30';
  };

  const getQualityColor = (quality: string) => {
    if (quality === 'STRONG') return 'text-green-400';
    if (quality === 'MODERATE') return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getZoneColor = (zone: string) => {
    if (zone.includes('EXTREME OB')) return 'text-red-400';
    if (zone.includes('Overbought')) return 'text-red-300';
    if (zone.includes('EXTREME OS')) return 'text-green-400';
    if (zone.includes('Oversold')) return 'text-green-300';
    return 'text-gray-400';
  };

  // API Key Setup Screen
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="bg-[#111] border border-gray-800 rounded-xl p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold">CCI Scanner</h1>
          </div>
          
          <p className="text-gray-400 mb-6">
            Enter your Polygon.io API key to get started. Your key is stored locally in your browser.
          </p>
          
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Enter Polygon API Key"
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-blue-500"
          />
          
          <button
            onClick={saveApiKey}
            disabled={!apiKeyInput.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
          >
            Save & Continue
          </button>
          
          <p className="text-gray-500 text-sm mt-4 text-center">
            Don't have a key? Get one at{' '}
            <a href="https://polygon.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              polygon.io
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">CCI Divergence Scanner</h1>
              <p className="text-gray-500 text-sm">Hash Capital Research</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {lastScan && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>Last scan: {lastScan.toLocaleTimeString()}</span>
              </div>
            )}
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-blue-600' : 'bg-[#1a1a1a] hover:bg-[#222]'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
            
            <button
              onClick={runScan}
              disabled={isScanning}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? `Scanning ${progress.current}/${progress.total}` : 'Scan Now'}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-[#111] border border-gray-800 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Timeframe</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as TimeframeOption)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="5">5 minute</option>
                  <option value="15">15 minute</option>
                  <option value="60">60 minute</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Min Strength</label>
                <select
                  value={minStrength}
                  onChange={(e) => setMinStrength(parseInt(e.target.value))}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="3">3+ (All)</option>
                  <option value="5">5+ (Moderate+)</option>
                  <option value="7">7+ (Strong only)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Auto Refresh</label>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                    autoRefresh 
                      ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                      : 'bg-[#1a1a1a] border-gray-700 text-gray-400'
                  }`}
                >
                  {autoRefresh ? '● Live (60s)' : 'Off'}
                </button>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">API Key</label>
                <button
                  onClick={() => {
                    localStorage.removeItem('polygon_api_key');
                    setApiKey('');
                    setIsConfigured(false);
                  }}
                  className="w-full bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Reset Key
                </button>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-gray-400 text-sm mb-2">Watchlist (comma separated)</label>
              <input
                type="text"
                value={watchlist}
                onChange={(e) => setWatchlist(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                placeholder="SPY, QQQ, NVDA, ..."
              />
            </div>
          </div>
        )}

        {/* Signals Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Active Signals
            {signals.length > 0 && (
              <span className="bg-yellow-500/20 text-yellow-400 text-sm px-2 py-0.5 rounded-full">
                {signals.length}
              </span>
            )}
          </h2>
          
          {signals.length === 0 ? (
            <div className="bg-[#111] border border-gray-800 rounded-xl p-8 text-center">
              {isScanning ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-gray-400">Scanning {progress.current} of {progress.total} symbols...</p>
                </div>
              ) : lastScan ? (
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-gray-600" />
                  <p className="text-gray-400">No divergence signals detected</p>
                  <p className="text-gray-500 text-sm">Try lowering minimum strength or changing timeframe</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Activity className="w-8 h-8 text-gray-600" />
                  <p className="text-gray-400">Click "Scan Now" to start scanning</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {signals.map((signal, i) => (
                <div
                  key={i}
                  className={`bg-[#111] border rounded-xl p-4 ${getTypeBg(signal.type)}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {signal.type.includes('BULL') ? (
                          <TrendingUp className="w-5 h-5 text-green-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-400" />
                        )}
                        <span className="text-xl font-bold">{signal.symbol}</span>
                      </div>
                      
                      <span className={`font-mono font-medium ${getTypeColor(signal.type)}`}>
                        {signal.type.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Strength:</span>
                        <span className={`font-bold ${getQualityColor(signal.quality)}`}>
                          {signal.strength.toFixed(1)}
                        </span>
                        <span className={`text-xs ${getQualityColor(signal.quality)}`}>
                          ({signal.quality})
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">CCI:</span>
                        <span className={signal.cciValue > 0 ? 'text-green-400' : 'text-red-400'}>
                          {signal.cciValue.toFixed(1)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Price:</span>
                        <span>${signal.price.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {signal.volumeConfirmed ? (
                          <CheckCircle className="w-4 h-4 text-green-400" title="Volume Confirmed" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-600" title="No Volume Confirmation" />
                        )}
                        {signal.momentumConfirmed ? (
                          <CheckCircle className="w-4 h-4 text-green-400" title="Momentum Confirmed" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-600" title="No Momentum Confirmation" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full Results Table */}
        {results.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              All Symbols
            </h2>
            
            <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-sm">
                      <th className="text-left p-3 font-medium">Symbol</th>
                      <th className="text-right p-3 font-medium">Price</th>
                      <th className="text-right p-3 font-medium">CCI</th>
                      <th className="text-right p-3 font-medium">Momentum</th>
                      <th className="text-center p-3 font-medium">Zone</th>
                      <th className="text-center p-3 font-medium">Signals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => (
                      <tr key={result.symbol} className="border-b border-gray-800/50 hover:bg-[#1a1a1a]">
                        <td className="p-3 font-medium">{result.symbol}</td>
                        <td className="p-3 text-right">${result.price.toFixed(2)}</td>
                        <td className={`p-3 text-right ${result.cci > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {result.cci.toFixed(1)}
                        </td>
                        <td className={`p-3 text-right ${result.momentum > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {result.momentum.toFixed(2)}
                        </td>
                        <td className={`p-3 text-center ${getZoneColor(result.zone)}`}>
                          {result.zone}
                        </td>
                        <td className="p-3 text-center">
                          {result.divergences.length > 0 ? (
                            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-sm">
                              {result.divergences.length}
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
