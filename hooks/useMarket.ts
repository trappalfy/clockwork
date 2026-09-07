'use client';

import { useQuery } from '@tanstack/react-query';
import type { Asset, MarketResponse, ErrorResponse } from '@/lib/types';

export interface UseMarketResult {
  assets: Asset[];
  ethUsd: number;
  isLoading: boolean;
  error: string | null;
}

async function fetchMarket(): Promise<MarketResponse> {
  const res = await fetch('/api/market');
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error((body as ErrorResponse).error ?? `market request failed (${res.status})`);
  return body as MarketResponse;
}

/** The full tradable catalog: symbol, address, decimals, live price. Refreshes every 15s. */
export function useMarket(): UseMarketResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['market'],
    queryFn: fetchMarket,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  return {
    assets: data?.assets ?? [],
    ethUsd: data?.ethUsd ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}
