// Polygon.io API client

export interface Bar {
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
  t: number;  // timestamp
}

export interface AggregatesResponse {
  results?: Bar[];
  status: string;
  resultsCount?: number;
}

export async function getAggregates(
  symbol: string,
  apiKey: string,
  multiplier: number = 5,
  timespan: string = 'minute',
  limit: number = 2000
): Promise<Bar[]> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 5);

  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];

  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=2000&apiKey=${apiKey}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data: AggregatesResponse = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return [];
    }
    
    return data.results;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return [];
  }
}
