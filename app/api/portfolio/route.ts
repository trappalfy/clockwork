import { NextResponse } from 'next/server';
import { formatEther, formatUnits, isAddress, type Address } from 'viem';
import { publicClient } from '@/lib/chain/client';
import { fetchStockAssets } from '@/lib/registry/assets';
import type { PortfolioResponse, ErrorResponse, Position } from '@/lib/types';

export const dynamic = 'force-dynamic';

const BALANCE_OF_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }],
}] as const;

function fail(error: string, status = 400) {
  const body: ErrorResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get('address');
  if (!address || !isAddress(address)) return fail('address query param must be a valid wallet address');
  const owner = address as Address;

  const [ethBalance, assets] = await Promise.all([
    publicClient.getBalance({ address: owner }),
    fetchStockAssets(),
  ]);

  // One multicall for all 194 assets rather than 194 separate reads -- this RPC throttles hard
  // on concurrency, the same lesson pool discovery already applied.
  const results = await publicClient.multicall({
    allowFailure: true,
    contracts: assets.map((a) => ({
      address: a.address, abi: BALANCE_OF_ABI, functionName: 'balanceOf', args: [owner],
    })),
  });

  const positions: Position[] = [];
  results.forEach((r, i) => {
    if (r.status !== 'success') return;
    const balance = r.result as bigint;
    if (balance <= 0n) return;
    const asset = assets[i];
    const tokens = Number(formatUnits(balance, asset.decimals));
    positions.push({
      symbol: asset.symbol,
      address: asset.address,
      balance: balance.toString(),
      decimals: asset.decimals,
      valueUsd: tokens * asset.price,
    });
  });
  positions.sort((a, b) => b.valueUsd - a.valueUsd);

  const body: PortfolioResponse = { ok: true, ethBalance: formatEther(ethBalance), positions };
  return NextResponse.json(body, { headers: { 'cache-control': 'private, max-age=5' } });
}
