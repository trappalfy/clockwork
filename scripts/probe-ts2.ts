import { parseUnits, formatUnits, type Address } from 'viem';
import { publicClient, } from '../lib/chain/client';
import { USDG, V4_QUOTER } from '../lib/chain/addresses';
import { poolKeyFor } from '../lib/quote/v4';

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
  const amount = parseUnits('100', 6);
  const fees = [...new Set(market.assets.map((a: any) => a.fee))].sort((a: any, b: any) => a - b) as number[];
  console.log('fee tiers:', fees.join(', '), '\n');

  for (const fee of fees) {
    const asset = market.assets.find((a: any) => a.fee === fee);
    // uint24 caps tickSpacing at 32767 (int24 max is larger, but pools stay well under)
    const cands = [...new Set([fee / 50, fee / 100, fee / 200, fee / 500, fee / 1000, fee / 2000, fee / 4400, 1, 10, 60, 200]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 32767))] as number[];
    let hit = '';
    for (const ts of cands) {
      const { poolKey, zeroForOne } = poolKeyFor(USDG, asset.address as Address, fee, ts);
      try {
        const { result } = await publicClient.simulateContract({ address: V4_QUOTER, abi: ABI,
          functionName: 'quoteExactInputSingle',
          args: [{ poolKey, zeroForOne, exactAmount: amount, hookData: '0x' }] });
        hit = `ts=${ts} (fee/${fee / ts}) -> ${formatUnits(result[0], asset.decimals).slice(0, 10)}`;
        break;
      } catch { /* keep trying */ }
    }
    console.log(`fee=${String(fee).padEnd(7)} ${asset.symbol.padEnd(6)} ${hit || 'not found; tried ' + cands.join(',')}`);
  }
}
main();
