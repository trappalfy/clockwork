import { NextResponse } from 'next/server';
import { CHAIN_ID } from '@/lib/chain/addresses';
import { fetchStockAssets } from '@/lib/registry/assets';
import { quoteEthUsd } from '@/lib/quote/v3';
import type { MarketResponse, ErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [assets, ethUsd] = await Promise.all([fetchStockAssets(), quoteEthUsd()]);
    const body: MarketResponse = { ok: true, chainId: CHAIN_ID, ethUsd, count: assets.length, assets };
    return NextResponse.json(body, { headers: { 'cache-control': 'public, max-age=15' } });
  } catch (e) {
    const body: ErrorResponse = { ok: false, error: e instanceof Error ? e.message : 'market lookup failed' };
    return NextResponse.json(body, { status: 502 });
  }
}
