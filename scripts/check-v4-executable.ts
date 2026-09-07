/** Forces the V4 branch (best-route selection often prefers V3) and proves it executes. */
import { parseEther, formatUnits, toHex, type Address } from 'viem';
import { quoteV3ExactInput } from '../lib/quote/v3';
import { quoteV4Single } from '../lib/quote/v4';
import { withSlippage } from '../lib/quote/engine';
import { buildBuyCalldata, encodeV3Path } from '../lib/router/encode';
import { publicClient } from '../lib/chain/client';
import { ETH_USDG_FEE, UNIVERSAL_ROUTER, USDG, WETH } from '../lib/chain/addresses';

const TRADER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
const AMOUNT = parseEther('0.05');
const BPS = 100;

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  const sample = market.assets.filter((a: any) => a.venue === 'V4').slice(0, 10);

  const eth2usdg = await quoteV3ExactInput(encodeV3Path([WETH, ETH_USDG_FEE, USDG]), AMOUNT);
  const usdgIn = withSlippage(eth2usdg.amountOut, BPS);
  console.log(`ETH leg: ${formatUnits(eth2usdg.amountOut, 6)} USDG, spending ${formatUnits(usdgIn, 6)}\n`);

  let ok = 0, bad = 0, noPool = 0;
  for (const asset of sample) {
    let q;
    try {
      q = await quoteV4Single(USDG, asset.address as Address, asset.fee, usdgIn);
    } catch {
      noPool++; console.log(`${asset.symbol.padEnd(7)} fee=${String(asset.fee).padEnd(7)} no v4 pool at that fee`); continue;
    }
    const minOut = withSlippage(q.amountOut, BPS);
    const { data, value } = buildBuyCalldata({
      venue: 'V4', amountInWei: AMOUNT, v3Hops: [WETH, ETH_USDG_FEE, USDG], v3MinOut: usdgIn,
      v4: { token: asset.address as Address, fee: asset.fee, tickSpacing: q.tickSpacing,
            currencyIn: USDG, amountIn: usdgIn, minOut },
      recipient: TRADER, deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    });
    try {
      await publicClient.request({ method: 'eth_call', params: [
        { from: TRADER, to: UNIVERSAL_ROUTER, data, value: toHex(value) } as any, 'latest',
        { [TRADER]: { balance: toHex(parseEther('10')) } } as any] } as any);
      ok++;
      console.log(`${asset.symbol.padEnd(7)} fee=${String(asset.fee).padEnd(7)} ts=${String(q.tickSpacing).padEnd(4)} out=${formatUnits(q.amountOut, asset.decimals).slice(0, 12).padEnd(13)} YES`);
    } catch (e: any) {
      bad++;
      console.log(`${asset.symbol.padEnd(7)} fee=${String(asset.fee).padEnd(7)} ts=${String(q.tickSpacing).padEnd(4)} REVERT ${(e.shortMessage || e.message || '').replace(/\n/g, ' ').slice(0, 80)}`);
    }
  }
  console.log(`\n${ok} executable, ${bad} reverted, ${noPool} without a pool at the catalog fee`);
}
main();
