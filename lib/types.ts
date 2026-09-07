import type { Address, Hex } from 'viem';

export interface Asset {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  price: number;
  logoUrl?: string;
  tradable: boolean;
}

export interface MarketResponse {
  ok: true;
  chainId: number;
  ethUsd: number;
  count: number;
  assets: Asset[];
}

export interface QuoteRequest {
  side: 'buy' | 'sell';
  symbol: string;
  /** ETH amount for a buy, token amount for a sell -- always a decimal string. */
  amount: string;
  recipient: Address;
  slippageBps?: number;
}

export interface Approval {
  label: string;
  to: Address;
  data: Hex;
  value: '0x0';
}

export interface QuoteResponse {
  ok: true;
  side: 'buy' | 'sell';
  symbol: string;
  amountIn: string;
  expectedOut: string;
  minOut: string;
  priceImpactBps: number;
  route: { venue: 'V3' | 'V4'; hops: string[]; fee: number };
  tx: { to: Address; data: Hex; value: string };
  /**
   * Plain on-chain transactions the seller must send before `tx` will succeed -- present only for
   * a sell that still needs Permit2 approval. Empty or absent otherwise.
   */
  approvals?: Approval[];
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export interface Position {
  symbol: string;
  address: Address;
  balance: string;
  decimals: number;
  valueUsd: number;
}

export interface PortfolioResponse {
  ok: true;
  ethBalance: string;
  positions: Position[];
}

