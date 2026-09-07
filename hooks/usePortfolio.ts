'use client';

import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import type { Position, PortfolioResponse, ErrorResponse } from '@/lib/types';

export interface UsePortfolioResult {
  ethBalance: string;
  positions: Position[];
  isLoading: boolean;
  error: string | null;
}

async function fetchPortfolio(address: string): Promise<PortfolioResponse> {
  const res = await fetch(`/api/portfolio?address=${address}`);
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error((body as ErrorResponse).error ?? `portfolio request failed (${res.status})`);
  return body as PortfolioResponse;
}

/** The connected wallet's ETH balance and tokenized-stock positions. Empty until a wallet connects. */
export function usePortfolio(): UsePortfolioResult {
  const { address, isConnected } = useConnection();

  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio', address],
    queryFn: () => fetchPortfolio(address!),
    enabled: isConnected && !!address,
    refetchInterval: 20_000,
  });

  return {
    ethBalance: data?.ethBalance ?? '0',
    positions: data?.positions ?? [],
    isLoading: isConnected ? isLoading : false,
    error: error instanceof Error ? error.message : null,
  };
}
