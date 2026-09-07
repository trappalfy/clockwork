/** Does discovery find the pools we already proved exist, and how many probes does it cost? */
import type { Address } from 'viem';
import { discoverPools } from '../lib/pools/discovery';
import { USDG, WETH } from '../lib/chain/addresses';

async function main() {
  const market: any = await (await fetch('https://mantaswap-desk.vercel.app/api/market')).json();
  const targets = ['SPY', 'NVDA', 'XLK', 'CRWD', 'TTWO', 'BA', 'MRVL', 'IONQ', 'ORCL', 'DDOG'];
  for (const sym of targets) {
    const asset = market.assets.find((a: any) => a.symbol === sym);
    if (!asset) continue;
    const t0 = Date.now();
    const pools = await discoverPools(asset.address as Address);
    const desc = pools.map((p) => {
      const base = p.base.toLowerCase() === USDG.toLowerCase() ? 'USDG' : p.base.toLowerCase() === WETH.toLowerCase() ? 'WETH' : '?';
      return p.kind === 'V3' ? `V3/${base}@${p.fee}` : `V4/${base}@${p.fee}:ts${p.tickSpacing}`;
    });
    console.log(`${sym.padEnd(6)} catalog=${asset.venue}@${String(asset.fee).padEnd(7)} ${Date.now() - t0}ms  found ${pools.length}: ${desc.join(' ') || 'NONE'}`);
  }
}
main();
