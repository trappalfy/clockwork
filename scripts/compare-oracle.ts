/**
 * Byte-for-byte check of our Universal Router encoder against a known-good implementation.
 *
 * We take the oracle's route (which venue, which hops, which fee) and its amounts, build the
 * calldata ourselves, and require an exact match. The routing decision is taken as given; the
 * encoding -- including this chain's fork-specific struct fields -- is what is under test.
 */
import { decodeAbiParameters, parseAbiParameters, type Address, type Hex } from 'viem';
import { buildBuyCalldata, type V3Hops } from '../lib/router/encode';
import { ETH_USDG_FEE, USDG, WETH } from '../lib/chain/addresses';

const ORACLE = 'https://mantaswap-desk.vercel.app/api/quote';
const MARKET = 'https://mantaswap-desk.vercel.app/api/market';
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
const AMOUNTS = ['0.01', '0.05', '0.5'];
const PER_VENUE = 12;

const EXACT_IN_SINGLE = [{
  type: 'tuple', components: [
    { name: 'poolKey', type: 'tuple', components: [
      { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }]},
    { name: 'zeroForOne', type: 'bool' }, { name: 'amountIn', type: 'uint128' },
    { name: 'amountOutMinimum', type: 'uint128' }, { name: 'minHopPriceX36', type: 'uint256' },
    { name: 'hookData', type: 'bytes' }],
}] as const;

/** Maps a route hop symbol to its token address. */
const hopAddress = (sym: string, token: Address): Address =>
  sym === 'ETH' ? WETH : sym === 'USDG' ? USDG : token;

async function main() {
  const market: any = await (await fetch(MARKET)).json();
  if (!Array.isArray(market.assets) || market.assets.length === 0) throw new Error('market returned no assets');

  const v3 = market.assets.filter((a: any) => a.venue === 'V3').slice(0, PER_VENUE);
  const v4 = market.assets.filter((a: any) => a.venue === 'V4').slice(0, PER_VENUE);
  const sample = [...v3, ...v4];
  console.log(`testing ${sample.length} assets (${v3.length} V3, ${v4.length} V4) x ${AMOUNTS.length} amounts`);

  let pass = 0, fail = 0, skip = 0;
  const shapes = new Set<string>();

  for (const asset of sample) for (const amountEth of AMOUNTS) {
    const symbol: string = asset.symbol;
    const q: any = await (await fetch(ORACLE, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol, amountEth, slippageBps: 100, recipient: RECIPIENT }) })).json();
    if (!q.ok || !q.tx) { skip++; continue; }

    const hops: string[] = q.route.hops;
    shapes.add(`${q.route.venue}:${hops.join('>')}`.replace(symbol, 'TOKEN'));

    const [, inputs, deadline] = decodeAbiParameters(
      parseAbiParameters('bytes commands, bytes[] inputs, uint256 deadline'), `0x${q.tx.data.slice(10)}`);
    const [, amountInWei] = decodeAbiParameters(parseAbiParameters('address, uint256'), inputs[0]);
    const leg = decodeAbiParameters(
      parseAbiParameters('address, uint256, uint256, bytes, bool, uint256[]'), inputs[1]);

    let ours: Hex;
    if (q.route.venue === 'V3') {
      // ETH -> token direct, or ETH -> USDG -> token. The ETH/USDG pool is always the 0.01% tier.
      const v3Hops: V3Hops = hops.length === 2
        ? [WETH, q.route.fee, asset.address]
        : [WETH, ETH_USDG_FEE, hopAddress(hops[1], asset.address), q.route.fee, asset.address];
      ours = buildBuyCalldata({ venue: 'V3', amountInWei, v3Hops, v3MinOut: leg[2],
        recipient: RECIPIENT, deadline }).data;
    } else {
      const [, params] = decodeAbiParameters(parseAbiParameters('bytes actions, bytes[] params'), inputs[2]);
      const [sw] = decodeAbiParameters(EXACT_IN_SINGLE, params[0]);
      const mid = hopAddress(hops[1], asset.address);
      ours = buildBuyCalldata({ venue: 'V4', amountInWei, v3Hops: [WETH, ETH_USDG_FEE, mid],
        v3MinOut: leg[2],
        v4: { token: asset.address, fee: q.route.fee, tickSpacing: sw.poolKey.tickSpacing,
              currencyIn: mid, amountIn: sw.amountIn, minOut: sw.amountOutMinimum },
        recipient: RECIPIENT, deadline }).data;
    }

    if (ours.toLowerCase() === (q.tx.data as string).toLowerCase()) { pass++; continue; }

    fail++;
    console.log(`FAIL  ${symbol.padEnd(6)} ${q.route.venue}  ${amountEth} ETH  fee=${q.route.fee}  hops=${hops.join('>')}`);
    const a = ours.slice(2), b = (q.tx.data as string).slice(2);
    console.log(`  lengths ours=${a.length / 2} theirs=${b.length / 2}`);
    for (let i = 0; i < Math.max(a.length, b.length); i += 64) {
      const wa = a.slice(i, i + 64), wb = b.slice(i, i + 64);
      if (wa !== wb) console.log(`  word ${String(i / 64).padStart(3)}  ours=${wa || '--'}\n              theirs=${wb || '--'}`);
    }
  }
  console.log(`\nroute shapes seen: ${[...shapes].join(', ')}`);
  console.log(`${pass} passed, ${fail} failed, ${skip} skipped`);
  process.exitCode = fail ? 1 : 0;
}
main();
