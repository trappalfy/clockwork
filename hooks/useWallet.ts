'use client';

import { useCallback } from 'react';
import { useConnect, useConnection, useDisconnect, useSwitchChain } from 'wagmi';
import type { Address } from 'viem';
import { CHAIN_ID } from '@/lib/chain/addresses';

export interface UseWalletResult {
  address: Address | undefined;
  isConnected: boolean;
  /** True once connected AND on Robinhood Chain -- the two most UIs actually need collapsed into one flag. */
  chainOk: boolean;
  connect: () => void;
  disconnect: () => void;
  switchChain: () => void;
  isSwitching: boolean;
  error: string | null;
}

/** Connects an injected wallet (MetaMask and similar) and tracks whether it's on Robinhood Chain. */
export function useWallet(): UseWalletResult {
  const connection = useConnection();
  const { connectors, connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  const doConnect = useCallback(() => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  }, [connectors, connect]);

  const doSwitch = useCallback(() => {
    switchChain({ chainId: CHAIN_ID });
  }, [switchChain]);

  const error = connectError?.message ?? switchError?.message ?? null;

  return {
    address: connection.address,
    isConnected: connection.isConnected,
    chainOk: connection.isConnected && connection.chainId === CHAIN_ID,
    connect: doConnect,
    disconnect,
    switchChain: doSwitch,
    isSwitching,
    error,
  };
}
