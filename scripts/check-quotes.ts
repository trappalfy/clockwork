/** Compares our own on-chain quotes against the reference implementation's numbers. */
import { parseEther, formatUnits, type Address } from 'viem';
import { encodeV3Path } from '../lib/router/encode';
import { quoteV3ExactInput } from '../lib/quote/v3';
import { ETH_USDG_FEE, USDG, WETH } from '../lib/chain/addresses';

const MARKET = 'https://mantaswap-desk.vercel.app/api/market';
const ORACLE = 'https://mantaswap-desk.vercel.app/api/quote';

async function main() {
  const market: any = await (await fetch(MARKET)).json();
  const v3Assets = market.assets.filter((a: any) => a.venue === 'V3').slice(0, 6);

  console.log('symbol   hops              ours            theirs          diff');
  for (const asset of v3Assets) {
    const q: any = await (await fetch(ORACLE, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol: asset.symbol, amountEth: '0.05', slippageBps: 100,
        recipient: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' }) })).json();
    if (!q.ok) { console.log(`${asset.symbol}: oracle error`); continue; }

    const hops: string[] = q.route.hops;
    const path = hops.length === 2
      ? encodeV3Path([WETH, q.route.fee, asset.address as Address])
      : encodeV3Path([WETH, ETH_USDG_FEE, USDG, q.route.fee, asset.address as Address]);

    try {
      const { amountOut } = await quoteV3ExactInput(path, parseEther('0.05'));
      const ours = Number(formatUnits(amountOut, asset.decimals));
      const theirs = Number(q.expectedTokens);
      const diff = theirs === 0 ? NaN : ((ours - theirs) / theirs) * 100;
      console.log(`${asset.symbol.padEnd(8)} ${hops.join('>').padEnd(17)} ${ours.toFixed(8).padEnd(15)} ${theirs.toFixed(8).padEnd(15)} ${diff.toFixed(4)}%`);
    } catch (e: any) {
      console.log(`${asset.symbol.padEnd(8)} QUOTE FAILED: ${(e.shortMessage || e.message || '').slice(0, 120)}`);
    }
  }
}
main();
