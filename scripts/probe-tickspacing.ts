/** Which tickSpacing pairs with the chain's exotic v4 fee tiers? */
import { parseUnits, formatUnits, type Address } from 'viem';
import { quoteV4Single, TICK_SPACING } from '../lib/quote/v4';
import { USDG } from '../lib/chain/addresses';
import { publicClient } from '../lib/chain/client';
import { V4_QUOTER } from '../lib/chain/addresses';
import { poolKeyFor } from '../lib/quote/v4';

const CANDIDATES = [1, 2, 5, 10, 20, 50, 60, 100, 120, 200, 500, 1000, 2000, 4000, 8000, 16000, 32767];

const ABI = [{
  name: 'quoteExactInputSingle', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'poolKey', type: 'tuple', components: [
      { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }] },
    { name: 'zeroForOne', type: 'bool' }, { name: 'exactAmount', type: 'uint128' },
    { name: 'hookData', type: 'bytes' }] }],
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
}] as const;

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  const targets = ['XLK', 'AMAT', 'MRVL', 'CRWD', 'IONQ', 'BA', 'SKHY', 'TTWO'];
  const amount = parseUnits('100', 6);

  for (const sym of targets) {
    const asset = market.assets.find((a: any) => a.symbol === sym);
    if (!asset) continue;
    const found: string[] = [];
    for (const ts of CANDIDATES) {
      const { poolKey, zeroForOne } = poolKeyFor(USDG, asset.address as Address, asset.fee, ts);
      try {
        const { result } = await publicClient.simulateContract({
          address: V4_QUOTER, abi: ABI, functionName: 'quoteExactInputSingle',
          args: [{ poolKey, zeroForOne, exactAmount: amount, hookData: '0x' }],
        });
        found.push(`ts=${ts} -> ${formatUnits(result[0], asset.decimals).slice(0, 10)}`);
      } catch { /* pool not initialized at this spacing */ }
    }
    console.log(`${sym.padEnd(6)} fee=${String(asset.fee).padEnd(7)} ${found.length ? found.join('  ') : 'NOT FOUND at any candidate spacing'}`);
  }
}
main();
