'use client';

import { useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import type { QuoteResponse, ErrorResponse } from '@/lib/types';
import { useWallet } from './useWallet';

export interface UseQuoteParams {
  side: 'buy' | 'sell';
  symbol: string;
  /** ETH amount for a buy, token amount for a sell -- a decimal string, as typed by the user. */
  amount: string;
  recipient: Address;
  slippageBps?: number;
}

export interface UseQuoteResult {
  quote: QuoteResponse | null;
  isLoading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 450;

/**
 * Prices a buy or sell as the user types. Debounced so a fast typist doesn't fire a request per
 * keystroke -- every request here also costs an RPC round-trip against a chain that throttles
 * hard on concurrency (see lib/pools/discovery.ts), so this matters more than usual UI polish.
 *
 * A sell additionally needs the connected wallet's own address (to check balance and Permit2
 * allowance server-side); this hook reads it from useWallet() rather than asking the caller to
 * thread it through by hand.
 */
export function useQuote({ side, symbol, amount, recipient, slippageBps }: UseQuoteParams): UseQuoteResult {
  const { address } = useWallet();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const amountNum = Number(amount);
    if (!symbol || !amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setQuote(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    if (side === 'sell' && !address) {
      setQuote(null);
      setError('Connect a wallet first');
      setIsLoading(false);
      return;
    }

    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const url = side === 'buy' ? '/api/quote' : '/api/sell';
        const body = side === 'buy'
          ? { symbol, amountEth: amount, recipient, slippageBps }
          : { symbol, amount, address, recipient, slippageBps };

        const res = await fetch(url, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        });
        const json = await res.json();
        if (id !== requestId.current) return; // a newer request superseded this one

        if (!res.ok || !json.ok) throw new Error((json as ErrorResponse).error ?? `quote failed (${res.status})`);
        setQuote(json as QuoteResponse);
      } catch (e) {
        if (id !== requestId.current) return;
        setQuote(null);
        setError(e instanceof Error ? e.message : 'quote failed');
      } finally {
        if (id === requestId.current) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [side, symbol, amount, recipient, slippageBps, address]);

  return { quote, isLoading, error };
}
