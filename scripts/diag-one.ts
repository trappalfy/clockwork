import { parseEther, formatUnits, type Address } from 'viem';
import { quoteV3ExactInput } from '../lib/quote/v3';
import { quoteV4Single } from '../lib/quote/v4';
import { encodeV3Path } from '../lib/router/encode';
import { ETH_USDG_FEE, USDG, WETH } from '../lib/chain/addresses';

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  for (const sym of ['TSLA', 'MSFT', 'XLK']) {
    const asset = market.assets.find((a: any) => a.symbol === sym);
    console.log(`\n=== ${sym}  catalog venue=${asset.venue} fee=${asset.fee} ===`);
    for (const fee of [500, 3000, 10000]) {
      try {
        const r = await quoteV3ExactInput(encodeV3Path([WETH, ETH_USDG_FEE, USDG, fee, asset.address as Address]), parseEther('0.05'));
        console.log(`  V3 via USDG @${fee}: ${formatUnits(r.amountOut, asset.decimals)}`);
      } catch (e: any) {
        console.log(`  V3 via USDG @${fee}: ${(e.shortMessage || e.message || '').replace(/\n/g, ' ').slice(0, 100)}`);
      }
    }
    try {
      const eth2 = await quoteV3ExactInput(encodeV3Path([WETH, ETH_USDG_FEE, USDG]), parseEther('0.05'));
      const r = await quoteV4Single(USDG, asset.address as Address, asset.fee, eth2.amountOut);
      console.log(`  V4 @${asset.fee}: ${formatUnits(r.amountOut, asset.decimals)} (ts=${r.tickSpacing})`);
    } catch (e: any) {
      console.log(`  V4 @${asset.fee}: ${(e.shortMessage || e.message || '').replace(/\n/g, ' ').slice(0, 100)}`);
    }
  }
}
main();
