import type { Address } from 'viem';
import { publicClient } from '../lib/chain/client';
import { USDG, V3_FACTORY, V4_STATE_VIEW, WETH } from '../lib/chain/addresses';
import { poolId } from '../lib/pools/discovery';
import { poolKeyFor } from '../lib/quote/v4';

const V3_ABI = [{ name: 'getPool', type: 'function', stateMutability: 'view',
  inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }],
  outputs: [{ type: 'address' }] }] as const;
const SV_ABI = [{ name: 'getSlot0', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'poolId', type: 'bytes32' }],
  outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' },
            { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] }] as const;

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  const nvda = market.assets.find((a: any) => a.symbol === 'NVDA').address as Address;
  const spy = market.assets.find((a: any) => a.symbol === 'SPY').address as Address;

  console.log('factory code:', ((await publicClient.getCode({ address: V3_FACTORY })) || '0x').length, 'chars');
  console.log('stateview code:', ((await publicClient.getCode({ address: V4_STATE_VIEW })) || '0x').length, 'chars');

  for (const fee of [500, 3000, 10000]) {
    try {
      const p = await publicClient.readContract({ address: V3_FACTORY, abi: V3_ABI,
        functionName: 'getPool', args: [USDG, nvda, fee] });
      console.log(`getPool(USDG,NVDA,${fee}) = ${p}`);
    } catch (e: any) { console.log(`getPool ${fee} ERROR: ${(e.shortMessage || e.message).slice(0, 140)}`); }
  }
  try {
    const p = await publicClient.readContract({ address: V3_FACTORY, abi: V3_ABI,
      functionName: 'getPool', args: [WETH, nvda, 500] });
    console.log(`getPool(WETH,NVDA,500) = ${p}`);
  } catch (e: any) { console.log(`getPool WETH ERROR: ${(e.shortMessage || e.message).slice(0, 140)}`); }

  const { poolKey } = poolKeyFor(USDG, spy, 3000, 60);
  const id = poolId(poolKey.currency0, poolKey.currency1, 3000, 60);
  console.log('SPY poolId:', id);
  try {
    const s = await publicClient.readContract({ address: V4_STATE_VIEW, abi: SV_ABI,
      functionName: 'getSlot0', args: [id] });
    console.log('getSlot0:', s);
  } catch (e: any) { console.log(`getSlot0 ERROR: ${(e.shortMessage || e.message).slice(0, 200)}`); }
}
main();
