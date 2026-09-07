/**
 * Proves our calldata actually executes, including on routes the reference never builds.
 * Uses eth_call with a balance state override, so nothing is sent and no funds are needed.
 */
import { parseEther, formatUnits, toHex, type Address } from 'viem';
import { quoteBuy, withSlippage } from '../lib/quote/engine';
import { buildBuyCalldata } from '../lib/router/encode';
import { publicClient } from '../lib/chain/client';
import { UNIVERSAL_ROUTER } from '../lib/chain/addresses';

const MARKET = 'https://mantaswap-desk.vercel.app/api/market';
const TRADER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
const AMOUNT = parseEther('0.05');
const SLIPPAGE_BPS = 100;

async function main() {
  const market: any = await (await fetch(MARKET)).json();
  const sample = [
    ...market.assets.filter((a: any) => a.venue === 'V3').slice(0, 6),
    ...market.assets.filter((a: any) => a.venue === 'V4').slice(0, 6),
  ];

  let ok = 0, reverted = 0, noRoute = 0;
  console.log('symbol  route                      expected        executes');

  for (const asset of sample) {
    let route;
    try {
      route = await quoteBuy(asset.address as Address, asset.symbol, AMOUNT);
    } catch {
      noRoute++; console.log(`${asset.symbol.padEnd(7)} no route`); continue;
    }

    const minOut = withSlippage(route.amountOut, SLIPPAGE_BPS);
    const { data, value } = buildBuyCalldata({
      venue: route.venue,
      amountInWei: AMOUNT,
      v3Hops: route.v3Hops,
      // For v4 the V3 leg must guarantee exactly what the v4 hop will spend.
      v3MinOut: route.venue === 'V3' ? minOut : route.v3Out,
      v4: route.v4 ? { token: asset.address as Address, fee: route.fee,
        tickSpacing: route.tickSpacing ?? 60, currencyIn: route.v4.currencyIn,
        amountIn: route.v4.amountIn, minOut } : undefined,
      recipient: TRADER,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    });

    const desc = `${route.venue}:${route.hops.join('>')}@${route.fee}`;
    const expected = Number(formatUnits(route.amountOut, asset.decimals)).toFixed(6);
    try {
      await publicClient.request({
        method: 'eth_call',
        params: [
          { from: TRADER, to: UNIVERSAL_ROUTER, data, value: toHex(value) } as any,
          'latest',
          { [TRADER]: { balance: toHex(parseEther('10')) } } as any,
        ],
      } as any);
      ok++;
      console.log(`${asset.symbol.padEnd(7)} ${desc.padEnd(26)} ${expected.padEnd(15)} YES`);
    } catch (e: any) {
      reverted++;
      const msg = (e.shortMessage || e.details || e.message || '').replace(/\n/g, ' ').slice(0, 90);
      console.log(`${asset.symbol.padEnd(7)} ${desc.padEnd(26)} ${expected.padEnd(15)} REVERT  ${msg}`);
    }
  }
  console.log(`\n${ok} executable, ${reverted} reverted, ${noRoute} without a route`);
}
main();
