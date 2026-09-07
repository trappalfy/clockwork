import type { Address } from 'viem';
import { CHAIN_ID } from '../chain/addresses';

const RHJ_BASE = 'https://api.robinhood.com/rhj';

interface RhjAsset {
  tokenSymbol: string;
  tokenName: string;
  deployments: Array<{ contractAddress: string; chainId: number }>;
  status: string;
  tokenDecimals: number;
  logoUrl?: string;
}

interface RhjQuote {
  tokenSymbol: string;
  bid: string;
  ask: string;
  isTradingHalt: boolean;
}

export interface StockAsset {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  /** Midpoint of bid/ask, in USD. */
  price: number;
  logoUrl?: string;
  tradable: boolean;
}

let cache: { at: number; assets: StockAsset[] } | null = null;
const TTL_MS = 60_000;

/**
 * Robinhood's own asset registry API, not an on-chain contract: `/assets` for symbol, contract
 * address and decimals, `/prices` (no symbol) for a bid/ask quote per asset in one call. Both are
 * public, unauthenticated, and cover all 194 tokenized stocks -- twice what any third-party
 * catalog on this chain lists.
 */
export async function fetchStockAssets(): Promise<StockAsset[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.assets;

  try {
    return await refreshStockAssets();
  } catch (e) {
    // A rate limit or a transient blip on Robinhood's registry shouldn't take every buy and sell
    // down with it. Serving the last known catalog is strictly better than an outage -- prices lag
    // by at most one refresh interval, and quotes still simulate against live pool state regardless.
    if (cache) return cache.assets;
    throw e;
  }
}

/**
 * A 429 here is usually gone within a moment, but the caller has no cache to fall back to on a
 * cold start -- every serverless instance boots with its own empty `cache`, so the very first
 * request an instance ever serves has nothing to fall back to and would otherwise 502 on exactly
 * the traffic burst most likely to trigger the rate limit in the first place.
 */
async function fetchWithRetry(url: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * attempt));
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.ok) return res;
    if (res.status !== 429) return res; // a non-rate-limit error won't fix itself by waiting
    last = res;
  }
  return last!;
}

async function refreshStockAssets(): Promise<StockAsset[]> {
  const [assetsRes, pricesRes] = await Promise.all([
    fetchWithRetry(`${RHJ_BASE}/assets`),
    fetchWithRetry(`${RHJ_BASE}/prices`),
  ]);
  if (!assetsRes.ok) throw new Error(`rhj/assets returned ${assetsRes.status}`);
  if (!pricesRes.ok) throw new Error(`rhj/prices returned ${pricesRes.status}`);

  const { assets }: { assets: RhjAsset[] } = await assetsRes.json();
  const { quotes }: { quotes: RhjQuote[] } = await pricesRes.json();
  const priceBySymbol = new Map(quotes.map((q) => [q.tokenSymbol, q]));

  const result: StockAsset[] = [];
  for (const a of assets) {
    if (a.status !== 'ASSET_STATUS_ACTIVE') continue;
    const deployment = a.deployments.find((d) => d.chainId === CHAIN_ID);
    if (!deployment) continue;
    const quote = priceBySymbol.get(a.tokenSymbol);
    if (!quote) continue;

    const bid = Number(quote.bid), ask = Number(quote.ask);
    result.push({
      symbol: a.tokenSymbol,
      name: a.tokenName,
      address: deployment.contractAddress as Address,
      decimals: a.tokenDecimals,
      price: bid > 0 && ask > 0 ? (bid + ask) / 2 : 0,
      logoUrl: a.logoUrl,
      tradable: !quote.isTradingHalt,
    });
  }

  cache = { at: Date.now(), assets: result };
  return result;
}
