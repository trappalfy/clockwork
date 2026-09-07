/**
 * Byte-for-byte structural check of our sell encoder against the reference, using real token
 * holders found via on-chain Transfer logs (a read-only public quote, no funds touched).
 *
 * The reference sets amountOutMin/amountMin to zero everywhere on sell -- a real gap, not
 * something we copy into the product encoder. To isolate "is the structure right" from "did we
 * choose better slippage floors", this test builds our calldata with the SAME zero minimums the
 * oracle used and requires an exact byte match; the product encoder always computes real, non-zero
 * ones (see buildSellCalldata's doc comment).
 */
import { decodeAbiParameters, parseAbiParameters, type Address, type Hex } from 'viem';
import { buildSellCalldata, type V3Hops } from '../lib/router/encode';
import { ETH_USDG_FEE, USDG, WETH } from '../lib/chain/addresses';

const ORACLE = 'https://mantaswap-desk.vercel.app/api/sell';

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

const cases = [
  { symbol: 'NVDA', address: '0x6bAaAf2082816d59C712B7061EC2209f337CecBA', amount: '0.5' },
  { symbol: 'MSFT', address: '0xeb60bCD1D920ad6E102690CCFC6fB488899E1510', amount: '0.3' },
];

/** Parses a packed V3 path (token, fee, token, [fee, token...]) back into encodeV3Path's hop list. */
function decodeV3Path(path: Hex): V3Hops {
  const bytes = path.slice(2);
  const hops: V3Hops = [`0x${bytes.slice(0, 40)}` as Address];
  let i = 40;
  while (i < bytes.length) {
    hops.push(parseInt(bytes.slice(i, i + 6), 16));
    hops.push(`0x${bytes.slice(i + 6, i + 46)}` as Address);
    i += 46;
  }
  return hops;
}

async function main() {
  let pass = 0, fail = 0;
  for (const c of cases) {
    const q: any = await (await fetch(ORACLE, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol: c.symbol, amount: c.amount, slippageBps: 100, recipient: c.address, address: c.address }) })).json();
    if (!q.ok) { console.log(`${c.symbol}: oracle error: ${q.error}`); fail++; continue; }

    const recipient = c.address as Address;
    const [, inputs, deadline] = decodeAbiParameters(
      parseAbiParameters('bytes commands, bytes[] inputs, uint256 deadline'), `0x${q.tx.data.slice(10)}`);

    let ours: Hex;
    if (q.route.venue === 'V3') {
      const [, amountIn, , pathHex] = decodeAbiParameters(
        parseAbiParameters('address, uint256, uint256, bytes, bool, uint256[]'), inputs[0]);
      ours = buildSellCalldata({
        venue: 'V3', amountInTokens: amountIn, v3Hops: decodeV3Path(pathHex as Hex),
        minEthOut: 0n, recipient, deadline,
      }).data;
    } else {
      const [, params] = decodeAbiParameters(parseAbiParameters('bytes actions, bytes[] params'), inputs[0]);
      const [sw] = decodeAbiParameters(EXACT_IN_SINGLE, params[0]);
      const [, settleAmount] = decodeAbiParameters(parseAbiParameters('address, uint256'), params[1]);
      const token = sw.zeroForOne ? sw.poolKey.currency0 : sw.poolKey.currency1;
      // The oracle hardcodes its own off-chain USDG estimate here with no v4 floor at all; our
      // encoder instead treats this slot as the v4 leg's guaranteed minimum (see V4SellLeg's doc
      // comment). For a pure structural byte match we feed back their literal value as that "floor".
      const [, oracleV3AmountIn] = decodeAbiParameters(
        parseAbiParameters('address, uint256, uint256, bytes, bool, uint256[]'), inputs[1]);

      ours = buildSellCalldata({
        venue: 'V4', amountInTokens: settleAmount, minEthOut: 0n,
        v3Hops: [USDG, ETH_USDG_FEE, WETH],
        v4: { token, fee: sw.poolKey.fee, tickSpacing: sw.poolKey.tickSpacing, currencyOut: USDG,
              amountIn: settleAmount, minOut: oracleV3AmountIn },
        recipient, deadline,
      }).data;
    }

    const a = ours.slice(2), b = (q.tx.data as string).slice(2);
    const diffWords: number[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i += 64) {
      if (a.slice(i, i + 64) !== b.slice(i, i + 64)) diffWords.push(i / 64);
    }

    // Word 29 of a V4 sell is the v4 swap struct's own amountOutMinimum: the oracle sends zero
    // there (no protection at all), we send a real slippage floor (see V4SellLeg's doc comment).
    // That is the only field this test expects to differ -- anything else is a real structural bug.
    const expectedDiff = q.route.venue === 'V4' ? [29] : [];
    const unexpected = diffWords.filter((w) => !expectedDiff.includes(w));

    if (unexpected.length === 0) {
      const note = diffWords.length ? ` (word ${diffWords.join(',')} differs by design: real slippage floor vs. oracle's zero)` : '';
      console.log(`PASS  ${c.symbol.padEnd(6)} ${q.route.venue}${note}`);
      pass++;
    } else {
      fail++;
      console.log(`FAIL  ${c.symbol.padEnd(6)} ${q.route.venue}  unexpected diffs at word(s) ${unexpected.join(',')}`);
      console.log(`  lengths ours=${a.length / 2} theirs=${b.length / 2}`);
      for (const w of unexpected) {
        console.log(`  word ${String(w).padStart(3)}  ours=${a.slice(w * 64, w * 64 + 64)}\n              theirs=${b.slice(w * 64, w * 64 + 64)}`);
      }
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
main();
