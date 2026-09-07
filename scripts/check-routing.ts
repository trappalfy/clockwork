/** Do we find a route at least as good as the reference implementation's? */
import { parseEther, formatUnits, type Address } from 'viem';
import { quoteBuy } from '../lib/quote/engine';

const MARKET = 'https://mantaswap-desk.vercel.app/api/market';
const ORACLE = 'https://mantaswap-desk.vercel.app/api/quote';
const AMOUNT = '0.05';

async function main() {
  const market: any = await (await fetch(MARKET)).json();
  const sample = [
    ...market.assets.filter((a: any) => a.venue === 'V3').slice(0, 8),
    ...market.assets.filter((a: any) => a.venue === 'V4').slice(0, 8),
  ];

  console.log('symbol  ourRoute              theirRoute            ours/theirs   verdict');
  let better = 0, same = 0, worse = 0, failed = 0;

  for (const asset of sample) {
    const [ourQ, theirQ] = await Promise.all([
      quoteBuy(asset.address as Address, asset.symbol, parseEther(AMOUNT)).catch((e) => e as Error),
      (await fetch(ORACLE, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol: asset.symbol, amountEth: AMOUNT, slippageBps: 100,
          recipient: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' }) })).json(),
    ]);

    if (ourQ instanceof Error) {
      failed++;
      console.log(`${asset.symbol.padEnd(7)} FAILED: ${ourQ.message.slice(0, 60)}`);
      continue;
    }

    const ours = Number(formatUnits(ourQ.amountOut, asset.decimals));
    const theirs = Number(theirQ.expectedTokens);
    const ratio = ours / theirs;
    const verdict = ratio > 1.0005 ? 'BETTER' : ratio < 0.9995 ? 'WORSE' : 'same';
    if (verdict === 'BETTER') better++; else if (verdict === 'WORSE') worse++; else same++;

    const ourDesc = `${ourQ.venue}:${ourQ.hops.join('>')}@${ourQ.fee}`;
    const theirDesc = `${theirQ.route.venue}:${theirQ.route.hops.join('>')}@${theirQ.route.fee}`;
    console.log(`${asset.symbol.padEnd(7)} ${ourDesc.padEnd(21)} ${theirDesc.padEnd(21)} ${ratio.toFixed(6)}      ${verdict}`);
  }

  console.log(`\n${better} better, ${same} same, ${worse} worse, ${failed} failed`);
}
main();
