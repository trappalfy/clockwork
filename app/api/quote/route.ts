import { NextResponse } from 'next/server';
import { isAddress, parseEther, type Address } from 'viem';
import { fetchStockAssets } from '@/lib/registry/assets';
import { UNIVERSAL_ROUTER } from '@/lib/chain/addresses';
import { quoteBuy, withSlippage } from '@/lib/quote/engine';
import { buildBuyCalldata } from '@/lib/router/encode';
import type { QuoteResponse, ErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_SLIPPAGE_BPS = 100;
const DEADLINE_SECONDS = 600;

function fail(error: string, status = 400) {
  const body: ErrorResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return fail('invalid JSON body');
  }

  const { symbol, amountEth, recipient, slippageBps } = payload ?? {};
  if (typeof symbol !== 'string' || !symbol) return fail('symbol is required');
  if (typeof amountEth !== 'string' || !amountEth) return fail('amountEth is required');
  if (typeof recipient !== 'string' || !isAddress(recipient)) return fail('recipient must be a valid address');

  const bps = Number.isFinite(slippageBps) ? Number(slippageBps) : DEFAULT_SLIPPAGE_BPS;
  if (bps < 1 || bps > 2000) return fail('slippageBps must be between 1 and 2000');

  let amountInWei: bigint;
  try {
    amountInWei = parseEther(amountEth);
  } catch {
    return fail('amountEth must be a decimal ETH amount');
  }
  if (amountInWei <= 0n) return fail('amountEth must be positive');

  const assets = await fetchStockAssets();
  const asset = assets.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
  if (!asset) return fail(`unknown symbol: ${symbol}`, 404);
  if (!asset.tradable) return fail(`${symbol} is not currently tradable`, 409);

  let route;
  try {
    route = await quoteBuy(asset.address, asset.symbol, amountInWei, bps);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'no route found', 502);
  }

  const minOut = withSlippage(route.amountOut, bps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);

  const { data, value } = buildBuyCalldata({
    venue: route.venue,
    amountInWei,
    v3Hops: route.v3Hops,
    // For a V4 route the V3 leg must guarantee exactly what the V4 hop spends, not a
    // slippage-padded amount -- padding it would leave the router unable to settle the v4 swap
    // when the V3 leg lands below its own quote.
    v3MinOut: route.venue === 'V3' ? minOut : route.v3Out,
    v4: route.v4
      ? {
          token: asset.address,
          fee: route.fee,
          tickSpacing: route.tickSpacing ?? 60,
          currencyIn: route.v4.currencyIn,
          amountIn: route.v4.amountIn,
          minOut,
        }
      : undefined,
    recipient: recipient as Address,
    deadline,
  });

  const body: QuoteResponse = {
    ok: true,
    side: 'buy',
    symbol: asset.symbol,
    amountIn: amountEth,
    expectedOut: route.amountOut.toString(),
    minOut: minOut.toString(),
    priceImpactBps: route.priceImpactBps,
    route: { venue: route.venue, hops: route.hops, fee: route.fee },
    tx: { to: UNIVERSAL_ROUTER, data, value: value.toString() },
  };
  return NextResponse.json(body);
}
