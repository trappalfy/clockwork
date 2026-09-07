/** How many of the chain's tokenized stocks can we route with the current candidate set? */
import { parseEther, formatUnits, type Address } from 'viem';
import { quoteBuy } from '../lib/quote/engine';

const CONCURRENCY = 2;

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  const assets = market.assets as any[];
  console.log(`routing all ${assets.length} assets with 0.05 ETH\n`);

  const missing: string[] = [];
  const worse: string[] = [];
  let routed = 0;

  const queue = [...assets];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const asset = queue.shift()!;
      try {
        const r = await quoteBuy(asset.address as Address, asset.symbol, parseEther('0.05'));
        routed++;
        const ours = Number(formatUnits(r.amountOut, asset.decimals));
        const theirs = asset.price ? (0.05 * market.ethUsd) / asset.price : 0;
        if (theirs > 0 && ours < theirs * 0.9) worse.push(`${asset.symbol}(${(ours / theirs).toFixed(3)})`);
      } catch {
        missing.push(`${asset.symbol}[${asset.venue}/${asset.fee}]`);
      }
    }
  });
  await Promise.all(workers);

  console.log(`routed: ${routed}/${assets.length}`);
  if (missing.length) console.log(`\nno route (${missing.length}): ${missing.join(', ')}`);
  if (worse.length) console.log(`\nsuspiciously below spot (${worse.length}): ${worse.join(', ')}`);
}
main();
