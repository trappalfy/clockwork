import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors/injected';
import { robinhoodChain } from '@/lib/chain/client';
import { RPC_URL } from '@/lib/chain/addresses';

/**
 * A single injected connector, deliberately -- this trades wallet coverage for the FRONTEND.md
 * constraint that /app load no third-party scripts (WalletConnect and Coinbase Wallet's SDKs both
 * phone home to their own relay/API domains). MetaMask and every other window.ethereum-injecting
 * wallet still work; what's ruled out is a wallet that only connects via a hosted relay.
 */
export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [injected()],
  transports: { [robinhoodChain.id]: http(RPC_URL) },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
