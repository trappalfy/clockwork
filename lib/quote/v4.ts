import type { Address } from 'viem';
import { publicClient } from '../chain/client';
import { V4_QUOTER } from '../chain/addresses';

/**
 * The v4 Quoter on this chain uses the CANONICAL struct -- probed directly, the forked variant
 * with `minHopPriceX36` reverts. Only the router carries this chain's struct changes.
 */
const V4_QUOTER_ABI = [{
  name: 'quoteExactInputSingle', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'poolKey', type: 'tuple', components: [
      { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }] },
    { name: 'zeroForOne', type: 'bool' },
    { name: 'exactAmount', type: 'uint128' },
    { name: 'hookData', type: 'bytes' }] }],
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
}] as const;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/** Uniswap's standard fee-to-tick-spacing mapping. */
export const TICK_SPACING: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };

/** v4 sorts pool currencies by address; the caller pays whichever side it holds. */
export function poolKeyFor(a: Address, b: Address, fee: number, tickSpacing: number) {
  const zeroForOne = a.toLowerCase() < b.toLowerCase();
  const [currency0, currency1] = zeroForOne ? [a, b] : [b, a];
  return { poolKey: { currency0, currency1, fee, tickSpacing, hooks: ZERO_ADDRESS }, zeroForOne };
}

/** Simulates an exact-input swap on a single v4 pool. Rejects when the pool does not exist. */
export async function quoteV4Single(
  tokenIn: Address, tokenOut: Address, fee: number, amountIn: bigint,
): Promise<{ amountOut: bigint; tickSpacing: number }> {
  const tickSpacing = TICK_SPACING[fee] ?? 60;
  const { poolKey, zeroForOne } = poolKeyFor(tokenIn, tokenOut, fee, tickSpacing);
  const result = await publicClient.readContract({
    address: V4_QUOTER, abi: V4_QUOTER_ABI, functionName: 'quoteExactInputSingle',
    args: [{ poolKey, zeroForOne, exactAmount: amountIn, hookData: '0x' }],
  });
  return { amountOut: result[0], tickSpacing };
}

/** Same call shaped for multicall batching. */
export function v4QuoteCall(tokenIn: Address, tokenOut: Address, fee: number, tickSpacing: number, amountIn: bigint) {
  const { poolKey, zeroForOne } = poolKeyFor(tokenIn, tokenOut, fee, tickSpacing);
  return { address: V4_QUOTER, abi: V4_QUOTER_ABI, functionName: 'quoteExactInputSingle',
           args: [{ poolKey, zeroForOne, exactAmount: amountIn, hookData: '0x' }] } as const;
}
