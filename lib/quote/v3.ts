import { formatUnits, parseEther, type Hex } from 'viem';
import { publicClient } from '../chain/client';
import { ETH_USDG_FEE, QUOTER_V2, USDG, WETH } from '../chain/addresses';
import { encodeV3Path } from '../router/encode';

/**
 * QuoterV2 reverts with the result by design, so this is an eth_call simulation, never a send.
 * The canonical signature is used as-is: unlike the router, the quoter on this chain has not
 * shown fork-specific struct changes.
 */
const QUOTER_ABI = [{
  name: 'quoteExactInput', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'path', type: 'bytes' }, { name: 'amountIn', type: 'uint256' }],
  outputs: [
    { name: 'amountOut', type: 'uint256' },
    { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
    { name: 'initializedTicksCrossedList', type: 'uint32[]' },
    { name: 'gasEstimate', type: 'uint256' },
  ],
}] as const;

export interface V3QuoteResult {
  amountOut: bigint;
  gasEstimate: bigint;
}

/** Simulates a multi-hop exact-input swap along a packed V3 path. */
export async function quoteV3ExactInput(path: Hex, amountIn: bigint): Promise<V3QuoteResult> {
  const result = await publicClient.readContract({
    address: QUOTER_V2, abi: QUOTER_ABI, functionName: 'quoteExactInput', args: [path, amountIn],
  });
  return { amountOut: result[0], gasEstimate: result[3] };
}

/** Same call shaped for multicall batching. */
export const v3QuoteCall = (path: Hex, amountIn: bigint) =>
  ({ address: QUOTER_V2, abi: QUOTER_ABI, functionName: 'quoteExactInput', args: [path, amountIn] }) as const;

let ethUsdCache: { at: number; value: number } | null = null;
const ETH_USD_TTL_MS = 15_000;

/**
 * ETH/USD, derived from the live WETH/USDG pool. USDG is dollar-pegged (cross-checked against an
 * independent price source to within 0.02%), so this needs no external price feed and stays
 * consistent with the same pool state the quote engine itself trades against.
 */
export async function quoteEthUsd(): Promise<number> {
  if (ethUsdCache && Date.now() - ethUsdCache.at < ETH_USD_TTL_MS) return ethUsdCache.value;
  const r = await quoteV3ExactInput(encodeV3Path([WETH, ETH_USDG_FEE, USDG]), parseEther('1'));
  const value = Number(formatUnits(r.amountOut, 6));
  ethUsdCache = { at: Date.now(), value };
  return value;
}
