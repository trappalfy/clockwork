import { createPublicClient, defineChain, http } from 'viem';
import { CHAIN_ID, EXPLORER, MULTICALL3, RPC_URL } from './addresses';

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: EXPLORER } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

/** Read-only client. Quotes are simulated, never sent. */
export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL, { batch: true, timeout: 15_000, retryCount: 2 }),
});
