/**
 * End-to-end check: quoteBuy() -> buildBuyCalldata() -> eth_call with a balance override.
 * This is the exact path /api/quote will take, run across a mixed sample including the
 * thin-pool names that price impact flags.
 */
import { parseEther, formatUnits, toHex, type Address } from 'viem';
import { quoteBuy, withSlippage } from '../lib/quote/engine';
import { buildBuyCalldata } from '../lib/router/encode';
import { publicClient } from '../lib/chain/client';
import { UNIVERSAL_ROUTER } from '../lib/chain/addresses';

const TRADER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
const AMOUNT = parseEther('0.05');
const SLIPPAGE_BPS = 100;

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  const symbols = ['NVDA', 'SPY', 'TSLA', 'MSFT', 'CELH', 'SOFI', 'IONQ', 'XLK', 'BA', 'ORCL', 'CRWD', 'GME'];
  const sample = symbols.map((s) => market.assets.find((a: any) => a.symbol === s)).filter(Boolean);

  let ok = 0, bad = 0;
  for (const asset of sample) {
    const route = await quoteBuy(asset.address as Address, asset.symbol, AMOUNT);
    const minOut = withSlippage(route.amountOut, SLIPPAGE_BPS);
    const { data, value } = buildBuyCalldata({
      venue: route.venue, amountInWei: AMOUNT, v3Hops: route.v3Hops,
      v3MinOut: route.venue === 'V3' ? minOut : route.v3Out,
      v4: route.v4 ? { token: asset.address as Address, fee: route.fee,
        tickSpacing: route.tickSpacing ?? 60, currencyIn: route.v4.currencyIn,
        amountIn: route.v4.amountIn, minOut } : undefined,
      recipient: TRADER, deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    });

    const desc = `${route.venue}:${route.hops.join('>')}@${route.fee}`;
    const impact = (route.priceImpactBps / 100).toFixed(1);
    try {
      await publicClient.request({ method: 'eth_call', params: [
        { from: TRADER, to: UNIVERSAL_ROUTER, data, value: toHex(value) } as any, 'latest',
        { [TRADER]: { balance: toHex(parseEther('10')) } } as any] } as any);
      ok++;
      console.log(`${asset.symbol.padEnd(6)} ${desc.padEnd(24)} impact=${impact}%  out=${formatUnits(route.amountOut, asset.decimals).slice(0, 10)}  YES`);
    } catch (e: any) {
      bad++;
      console.log(`${asset.symbol.padEnd(6)} ${desc.padEnd(24)} REVERT ${(e.shortMessage || e.message || '').slice(0, 80)}`);
    }
  }
  console.log(`\n${ok} executable, ${bad} reverted`);
}
main();
