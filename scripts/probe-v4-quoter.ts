/** Does the v4 Quoter on this chain use the canonical struct, or the forked one with minHopPriceX36? */
import { parseUnits, type Address } from 'viem';
import { publicClient } from '../lib/chain/client';
import { USDG, V4_QUOTER } from '../lib/chain/addresses';

const poolKey = (a: Address, b: Address, fee: number, tickSpacing: number) => {
  const zeroForOne = a.toLowerCase() < b.toLowerCase();
  const [currency0, currency1] = zeroForOne ? [a, b] : [b, a];
  return { key: { currency0, currency1, fee, tickSpacing,
    hooks: '0x0000000000000000000000000000000000000000' as Address }, zeroForOne };
};

const POOL_KEY = { name: 'poolKey', type: 'tuple', components: [
  { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' }] } as const;

const canonical = [{
  name: 'quoteExactInputSingle', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    POOL_KEY, { name: 'zeroForOne', type: 'bool' },
    { name: 'exactAmount', type: 'uint128' }, { name: 'hookData', type: 'bytes' }] }],
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
}] as const;

const forked = [{
  name: 'quoteExactInputSingle', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    POOL_KEY, { name: 'zeroForOne', type: 'bool' },
    { name: 'exactAmount', type: 'uint128' },
    { name: 'minHopPriceX36', type: 'uint256' },
    { name: 'hookData', type: 'bytes' }] }],
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
}] as const;

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  const asset = market.assets.find((a: any) => a.venue === 'V4');
  console.log(`probing with ${asset.symbol} fee=${asset.fee}`);

  const { key, zeroForOne } = poolKey(USDG, asset.address, asset.fee, 60);
  const amount = parseUnits('100', 6); // 100 USDG

  for (const [label, abi, args] of [
    ['canonical', canonical, [{ poolKey: key, zeroForOne, exactAmount: amount, hookData: '0x' }]],
    ['forked   ', forked, [{ poolKey: key, zeroForOne, exactAmount: amount, minHopPriceX36: 0n, hookData: '0x' }]],
  ] as const) {
    try {
      const { result } = await publicClient.simulateContract({
        address: V4_QUOTER, abi: abi as any, functionName: 'quoteExactInputSingle', args: args as any });
      console.log(`${label}  OK   amountOut=${(result as any)[0]}  gas=${(result as any)[1]}`);
    } catch (e: any) {
      console.log(`${label}  FAIL ${(e.shortMessage || e.message || '').slice(0, 140).replace(/\n/g, ' ')}`);
    }
  }
}
main();
