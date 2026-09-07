'use client';

import { useCallback, useState } from 'react';
import { useSendTransaction } from 'wagmi';
import type { Hash } from 'viem';
import { publicClient } from '@/lib/chain/client';
import type { QuoteResponse } from '@/lib/types';

export type SwapStatus = 'idle' | 'approving' | 'signing' | 'pending' | 'success' | 'error';

export interface UseSwapResult {
  execute: (quote: QuoteResponse) => Promise<void>;
  status: SwapStatus;
  /** Set while status is 'approving': which approval this is, out of how many. */
  approvalStep: { current: number; total: number } | null;
  txHash: Hash | null;
  error: string | null;
  reset: () => void;
}

/**
 * Sends whatever a quote asked for. A buy is one transaction. A sell may need one or two plain
 * on-chain approvals first (see quote.approvals, from lib/chain/permit2.ts) -- never an off-chain
 * signature -- each confirmed on-chain before the next step, so the router never sees a swap it
 * isn't yet allowed to execute.
 */
export function useSwap(): UseSwapResult {
  const { sendTransactionAsync } = useSendTransaction();
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [approvalStep, setApprovalStep] = useState<{ current: number; total: number } | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle'); setApprovalStep(null); setTxHash(null); setError(null);
  }, []);

  const execute = useCallback(async (quote: QuoteResponse) => {
    setError(null);
    setTxHash(null);
    try {
      const approvals = quote.approvals ?? [];
      for (let i = 0; i < approvals.length; i++) {
        setStatus('approving');
        setApprovalStep({ current: i + 1, total: approvals.length });
        const step = approvals[i];
        const hash = await sendTransactionAsync({ to: step.to, data: step.data, value: 0n });
        await publicClient.waitForTransactionReceipt({ hash });
      }
      setApprovalStep(null);

      setStatus('signing');
      const hash = await sendTransactionAsync({
        to: quote.tx.to, data: quote.tx.data, value: BigInt(quote.tx.value),
      });
      setTxHash(hash);

      setStatus('pending');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('transaction reverted on-chain');
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'swap failed');
    }
  }, [sendTransactionAsync]);

  return { execute, status, approvalStep, txHash, error, reset };
}
