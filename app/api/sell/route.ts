import { NextResponse } from 'next/server';
import { isAddress, parseUnits, type Address } from 'viem';
import { fetchStockAssets } from '@/lib/registry/assets';
import { quoteSell, withSlippage } from '@/lib/quote/engine';
import { buildSellCalldata } from '@/lib/router/encode';
import { missingApprovals, tokenBalance } from '@/lib/chain/permit2';
import { UNIVERSAL_ROUTER } from '@/lib/chain/addresses';
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

  const { symbol, amount, address, recipient, slippageBps } = payload ?? {};
  if (typeof symbol !== 'string' || !symbol) return fail('symbol is required');
  if (typeof amount !== 'string' || !amount) return fail('amount is required');
  if (typeof address !== 'string' || !isAddress(address)) return fail('address (the seller) must be a valid wallet address');
  if (typeof recipient !== 'string' || !isAddress(recipient)) return fail('recipient must be a valid address');

  const bps = Number.isFinite(slippageBps) ? Number(slippageBps) : DEFAULT_SLIPPAGE_BPS;
  if (bps < 1 || bps > 2000) return fail('slippageBps must be between 1 and 2000');

  const assets = await fetchStockAssets();
  const asset = assets.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
  if (!asset) return fail(`unknown symbol: ${symbol}`, 404);
  if (!asset.tradable) return fail(`${symbol} is not currently tradable`, 409);

  let amountInTokens: bigint;
  try {
    amountInTokens = parseUnits(amount, asset.decimals);
  } catch {
    return fail('amount must be a decimal token amount');
  }
  if (amountInTokens <= 0n) return fail('amount must be positive');

  const balance = await tokenBalance(asset.address, address as Address);
  if (balance < amountInTokens) return fail(`insufficient ${symbol} balance`, 409);

  let route;
  try {
    route = await quoteSell(asset.address, asset.symbol, amountInTokens, bps);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'no route found', 502);
  }

  const minEthOut = withSlippage(route.amountOut, bps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);

  const { data, value } = buildSellCalldata({
    venue: route.venue,
    amountInTokens,
    v3Hops: route.v3Hops,
    minEthOut,
    v4: route.v4
      ? {
          token: asset.address,
          fee: route.fee,
          tickSpacing: route.tickSpacing ?? 60,
          currencyOut: route.v4.currencyOut,
          amountIn: amountInTokens,
          // The v4 leg's own guaranteed floor; also reused as the V3 leg's literal amountIn so it
          // never tries to spend more than the v4 swap is certain to have produced.
          minOut: withSlippage(route.v4.amountOut, bps),
        }
      : undefined,
    recipient: recipient as Address,
    deadline,
  });

  const approvals = await missingApprovals(asset.address, address as Address, amountInTokens, asset.symbol);

  const body: QuoteResponse = {
    ok: true,
    side: 'sell',
    symbol: asset.symbol,
    amountIn: amount,
    expectedOut: route.amountOut.toString(),
    minOut: minEthOut.toString(),
    priceImpactBps: route.priceImpactBps,
    route: { venue: route.venue, hops: route.hops, fee: route.fee },
    tx: { to: UNIVERSAL_ROUTER, data, value: value.toString() },
    ...(approvals.length ? { approvals } : {}),
  };
  return NextResponse.json(body);
}
