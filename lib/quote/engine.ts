import type { Address } from 'viem';
import { publicClient } from '../chain/client';
import { ETH_USDG_FEE, USDG, WETH } from '../chain/addresses';
import { discoverPools } from '../pools/discovery';
import { encodeV3Path, type V3Hops } from '../router/encode';
import { v3QuoteCall } from './v3';
import { v4QuoteCall } from './v4';

export interface RouteQuote {
  venue: 'V3' | 'V4';
  /** Human-readable hop symbols, e.g. ['ETH', 'USDG', 'NVDA']. */
  hops: string[];
  /** Fee tier of the pool that buys the token. */
  fee: number;
  tickSpacing?: number;
  /** V3 leg of the route, ready for the encoder. */
  v3Hops: V3Hops;
  /** What the V3 leg is guaranteed to deliver. */
  v3Out: bigint;
  /** Tokens received, before slippage. */
  amountOut: bigint;
  /** Present only for V4 routes. */
  v4?: { currencyIn: Address; amountIn: bigint };
  /** How far execution lands below this route's near-spot price, in basis points. */
  priceImpactBps: number;
}

/** Applies a slippage tolerance, in basis points. */
export function withSlippage(amount: bigint, bps: number): bigint {
  return (amount * BigInt(10_000 - bps)) / 10_000n;
}

/**
 * Distinguishes the two ways a token can end up with zero simulated routes -- they read very
 * differently to whoever sees the error. `poolCount === 0` means no pool contract exists for this
 * token at all, on any fee tier we probe. `poolCount > 0` means one or more pools were found on
 * the factory but every one of them quoted zero or reverted -- in practice this is a pool that
 * exists and has an initialized price but has never had liquidity deposited into it (confirmed by
 * hand against a live sample: slot0 present, `liquidity() == 0`, the quoter reverting with "SPL").
 * The registry's own `tradable` flag reflects Robinhood's halt status, not on-chain liquidity, so
 * a name can be freshly listed there before any LP has funded its pool here -- this is that case,
 * not a bug in discovery or the fee-tier list.
 */
function noRouteMessage(symbol: string, poolCount: number): string {
  return poolCount > 0
    ? `${symbol} has no on-chain liquidity yet`
    : `no route found for ${symbol}`;
}

/**
 * Finds the best ETH -> token route by simulating every live pool against current state.
 *
 * Pools are discovered and cached first, so only routes that actually exist get simulated, and
 * the simulations go out as two multicalls rather than dozens of separate requests -- this RPC
 * throttles hard on concurrency.
 */
export async function quoteBuy(
  token: Address, symbol: string, amountInWei: bigint, slippageBps = 100,
): Promise<RouteQuote> {
  const pools = await discoverPools(token);
  const isUsdg = (a: Address) => a.toLowerCase() === USDG.toLowerCase();

  const v3Direct = pools.filter((p) => p.kind === 'V3' && !isUsdg(p.base));
  const v3ViaUsdg = pools.filter((p) => p.kind === 'V3' && isUsdg(p.base));
  const v4Pools = pools.filter((p) => p.kind === 'V4');

  // Round one: price the ETH leg and every V3 candidate together.
  const ethLegPath = encodeV3Path([WETH, ETH_USDG_FEE, USDG]);
  const round1 = await publicClient.multicall({
    allowFailure: true,
    contracts: [
      v3QuoteCall(ethLegPath, amountInWei),
      ...v3Direct.map((p) => v3QuoteCall(encodeV3Path([WETH, p.fee, token]), amountInWei)),
      ...v3ViaUsdg.map((p) =>
        v3QuoteCall(encodeV3Path([WETH, ETH_USDG_FEE, USDG, p.fee, token]), amountInWei)),
    ] as any,
  });

  const routes: RouteQuote[] = [];
  const readOut = (r: any): bigint | null =>
    r?.status === 'success' && Array.isArray(r.result) ? (r.result[0] as bigint) : null;

  v3Direct.forEach((p, i) => {
    const out = readOut(round1[1 + i]);
    if (out && out > 0n) routes.push({ venue: 'V3', hops: ['ETH', symbol], fee: p.fee,
      v3Hops: [WETH, p.fee, token], v3Out: out, amountOut: out, priceImpactBps: 0 });
  });
  v3ViaUsdg.forEach((p, i) => {
    const out = readOut(round1[1 + v3Direct.length + i]);
    if (out && out > 0n) routes.push({ venue: 'V3', hops: ['ETH', 'USDG', symbol], fee: p.fee,
      v3Hops: [WETH, ETH_USDG_FEE, USDG, p.fee, token], v3Out: out, amountOut: out, priceImpactBps: 0 });
  });

  // Round two: v4 legs, priced on the USDG the ETH leg is guaranteed to deliver.
  const ethLegOut = readOut(round1[0]);
  if (ethLegOut && ethLegOut > 0n && v4Pools.length > 0) {
    const usdgIn = withSlippage(ethLegOut, slippageBps);
    const round2 = await publicClient.multicall({
      allowFailure: true,
      contracts: v4Pools.map((p) =>
        v4QuoteCall(USDG, token, p.fee, (p as any).tickSpacing, usdgIn)) as any,
    });
    v4Pools.forEach((p, i) => {
      const out = readOut(round2[i]);
      if (out && out > 0n) routes.push({
        venue: 'V4', hops: ['ETH', 'USDG', symbol], fee: p.fee, tickSpacing: (p as any).tickSpacing,
        v3Hops: [WETH, ETH_USDG_FEE, USDG], v3Out: usdgIn, amountOut: out,
        v4: { currencyIn: USDG, amountIn: usdgIn }, priceImpactBps: 0,
      });
    });
  }

  if (routes.length === 0) throw new Error(noRouteMessage(symbol, pools.length));
  const best = routes.reduce((a, r) => (r.amountOut > a.amountOut ? r : a));
  best.priceImpactBps = await measureImpact(best, token, amountInWei, slippageBps);
  return best;
}

/**
 * Price impact measured against the route itself: the same path priced at a hundredth of the
 * size approximates spot, and the shortfall at full size is what the trade actually costs.
 * Thin pools on this chain can swallow most of a trade, so this is not decoration.
 */
async function measureImpact(
  route: RouteQuote, token: Address, amountInWei: bigint, slippageBps: number,
): Promise<number> {
  const probe = amountInWei / 100n;
  if (probe <= 0n) return 0;
  try {
    let smallOut: bigint;
    if (route.venue === 'V3') {
      const r = await publicClient.readContract(v3QuoteCall(encodeV3Path(route.v3Hops), probe) as any);
      smallOut = (r as readonly bigint[])[0];
    } else {
      const leg = await publicClient.readContract(
        v3QuoteCall(encodeV3Path([WETH, ETH_USDG_FEE, USDG]), probe) as any);
      const usdgIn = withSlippage((leg as readonly bigint[])[0], slippageBps);
      const r = await publicClient.readContract(
        v4QuoteCall(USDG, token, route.fee, route.tickSpacing ?? 60, usdgIn) as any);
      smallOut = (r as readonly bigint[])[0];
    }
    if (smallOut <= 0n) return 0;
    // Scale the probe up to full size; whatever the real quote falls short by is the impact.
    const reference = smallOut * (amountInWei / probe);
    if (reference <= route.amountOut) return 0;
    return Number(((reference - route.amountOut) * 10_000n) / reference);
  } catch {
    return 0;
  }
}

export interface SellRouteQuote {
  venue: 'V3' | 'V4';
  hops: string[];
  fee: number;
  tickSpacing?: number;
  /** V3 leg, ready for the encoder. Runs to WETH for V3, or from the v4 leg's output to WETH for V4. */
  v3Hops: V3Hops;
  /** ETH received, before slippage. */
  amountOut: bigint;
  /** Present only for V4 routes: the token -> USDG leg. */
  v4?: { currencyOut: Address; amountOut: bigint };
  priceImpactBps: number;
}

/**
 * Finds the best token -> ETH route. Mirrors quoteBuy(): same pool discovery, same two-multicall
 * shape, reversed hop order. The sell amount is known upfront (unlike the buy side's ETH leg), so
 * every V3 candidate and every V4 first hop can be batched in a single round.
 */
export async function quoteSell(
  token: Address, symbol: string, amountInTokens: bigint, slippageBps = 100,
): Promise<SellRouteQuote> {
  const pools = await discoverPools(token);
  const isUsdg = (a: Address) => a.toLowerCase() === USDG.toLowerCase();

  const v3Direct = pools.filter((p) => p.kind === 'V3' && !isUsdg(p.base));
  const v3ViaUsdg = pools.filter((p) => p.kind === 'V3' && isUsdg(p.base));
  const v4Pools = pools.filter((p) => p.kind === 'V4');

  const round1 = await publicClient.multicall({
    allowFailure: true,
    contracts: [
      ...v3Direct.map((p) => v3QuoteCall(encodeV3Path([token, p.fee, WETH]), amountInTokens)),
      ...v3ViaUsdg.map((p) =>
        v3QuoteCall(encodeV3Path([token, p.fee, USDG, ETH_USDG_FEE, WETH]), amountInTokens)),
      ...v4Pools.map((p) => v4QuoteCall(token, USDG, p.fee, (p as any).tickSpacing, amountInTokens)),
    ] as any,
  });

  const routes: SellRouteQuote[] = [];
  const readOut = (r: any): bigint | null =>
    r?.status === 'success' && Array.isArray(r.result) ? (r.result[0] as bigint) : null;

  v3Direct.forEach((p, i) => {
    const out = readOut(round1[i]);
    if (out && out > 0n) routes.push({ venue: 'V3', hops: [symbol, 'ETH'], fee: p.fee,
      v3Hops: [token, p.fee, WETH], amountOut: out, priceImpactBps: 0 });
  });
  v3ViaUsdg.forEach((p, i) => {
    const out = readOut(round1[v3Direct.length + i]);
    if (out && out > 0n) routes.push({ venue: 'V3', hops: [symbol, 'USDG', 'ETH'], fee: p.fee,
      v3Hops: [token, p.fee, USDG, ETH_USDG_FEE, WETH], amountOut: out, priceImpactBps: 0 });
  });

  const v4Outs = v4Pools.map((_, i) => readOut(round1[v3Direct.length + v3ViaUsdg.length + i]));
  const liveV4 = v4Pools.filter((_, i) => v4Outs[i] && v4Outs[i]! > 0n);
  if (liveV4.length > 0) {
    const round2 = await publicClient.multicall({
      allowFailure: true,
      contracts: liveV4.map((p, i) => {
        const usdgOut = withSlippage(v4Outs[v4Pools.indexOf(p)]!, slippageBps);
        return v3QuoteCall(encodeV3Path([USDG, ETH_USDG_FEE, WETH]), usdgOut);
      }) as any,
    });
    liveV4.forEach((p, i) => {
      const usdgOut = v4Outs[v4Pools.indexOf(p)]!;
      const ethOut = readOut(round2[i]);
      if (ethOut && ethOut > 0n) routes.push({
        venue: 'V4', hops: [symbol, 'USDG', 'ETH'], fee: p.fee, tickSpacing: (p as any).tickSpacing,
        v3Hops: [USDG, ETH_USDG_FEE, WETH], amountOut: ethOut,
        v4: { currencyOut: USDG, amountOut: usdgOut }, priceImpactBps: 0,
      });
    });
  }

  if (routes.length === 0) throw new Error(noRouteMessage(symbol, pools.length));
  const best = routes.reduce((a, r) => (r.amountOut > a.amountOut ? r : a));
  best.priceImpactBps = await measureSellImpact(best, token, amountInTokens, slippageBps);
  return best;
}

async function measureSellImpact(
  route: SellRouteQuote, token: Address, amountInTokens: bigint, slippageBps: number,
): Promise<number> {
  const probe = amountInTokens / 100n;
  if (probe <= 0n) return 0;
  try {
    let smallOut: bigint;
    if (route.venue === 'V3') {
      const r = await publicClient.readContract(v3QuoteCall(encodeV3Path(route.v3Hops), probe) as any);
      smallOut = (r as readonly bigint[])[0];
    } else {
      const leg = await publicClient.readContract(
        v4QuoteCall(token, USDG, route.fee, route.tickSpacing ?? 60, probe) as any);
      const usdgOut = withSlippage((leg as readonly bigint[])[0], slippageBps);
      const r = await publicClient.readContract(
        v3QuoteCall(encodeV3Path([USDG, ETH_USDG_FEE, WETH]), usdgOut) as any);
      smallOut = (r as readonly bigint[])[0];
    }
    if (smallOut <= 0n) return 0;
    const reference = smallOut * (amountInTokens / probe);
    if (reference <= route.amountOut) return 0;
    return Number(((reference - route.amountOut) * 10_000n) / reference);
  } catch {
    return 0;
  }
}
