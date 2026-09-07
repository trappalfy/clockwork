/** Does price-impact measurement flag the thin pools we already found, without false alarms? */
import { parseEther, type Address } from 'viem';
import { quoteBuy } from '../lib/quote/engine';

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  const targets = ['NVDA', 'SPY', 'CELH', 'SOFI', 'IONQ', 'AAPL', 'MU'];
  for (const sym of targets) {
    const asset = market.assets.find((a: any) => a.symbol === sym);
    if (!asset) continue;
    try {
      const r = await quoteBuy(asset.address as Address, sym, parseEther('0.05'));
      const pct = (r.priceImpactBps / 100).toFixed(2);
      const flag = r.priceImpactBps > 300 ? '  <-- WARN' : '';
      console.log(`${sym.padEnd(6)} ${r.venue}:${r.hops.join('>')}@${r.fee}  impact=${pct}%${flag}`);
    } catch (e: any) {
      console.log(`${sym.padEnd(6)} ERROR: ${e.message}`);
    }
  }
}
main();
