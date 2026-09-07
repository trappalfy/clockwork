import { parseEther, formatUnits } from 'viem';
import { quoteV3ExactInput } from '../lib/quote/v3';
import { encodeV3Path } from '../lib/router/encode';
import { ETH_USDG_FEE, USDG, WETH } from '../lib/chain/addresses';

async function main() {
  const r = await quoteV3ExactInput(encodeV3Path([WETH, ETH_USDG_FEE, USDG]), parseEther('1'));
  console.log('1 ETH ->', formatUnits(r.amountOut, 6), 'USDG');
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  console.log('oracle ethUsd:', market.ethUsd);
}
main();
