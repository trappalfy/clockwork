import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem';
import { publicClient } from '../chain/client';
import { USDG, V3_FACTORY, V4_STATE_VIEW, WETH } from '../chain/addresses';
import { poolKeyFor, ZERO_ADDRESS } from '../quote/v4';

/**
 * Fee tiers observed in use on this chain. Far wider than Uniswap's canonical four -- the high
 * tiers carry the thinly traded names.
 */
export const FEE_TIERS = [
  100, 500, 3000, 8000, 10000, 20000, 30000, 33000, 50000,
  100000, 210000, 250000, 320000, 500000, 750000, 880000, 910000,
] as const;

/**
 * Tick spacing is not a free parameter: on this chain it is the fee divided by 50 or by 100.
 * Probed across every live tier, so both divisors are tried and whichever pool exists wins.
 */
export const tickSpacingCandidates = (fee: number): number[] =>
  [...new Set([fee / 50, fee / 100].filter((n) => Number.isInteger(n) && n >= 1 && n <= 32767))];

const V3_FACTORY_ABI = [{
  name: 'getPool', type: 'function', stateMutability: 'view',
  inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }],
  outputs: [{ type: 'address' }],
}] as const;

const STATE_VIEW_ABI = [{
  name: 'getSlot0', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'poolId', type: 'bytes32' }],
  outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' },
    { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' },
  ],
}] as const;

export interface V3Pool { kind: 'V3'; base: Address; fee: number }
export interface V4Pool { kind: 'V4'; base: Address; fee: number; tickSpacing: number }
export type Pool = V3Pool | V4Pool;

/** v4 pool id is the hash of the encoded pool key. */
export function poolId(currency0: Address, currency1: Address, fee: number, tickSpacing: number): Hex {
  return keccak256(encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
    [currency0, currency1, fee, tickSpacing, ZERO_ADDRESS],
  ));
}

const cache = new Map<string, { at: number; pools: Pool[] }>();
const TTL_MS = 10 * 60 * 1000;

function poolKey(p: Pool): string {
  return p.kind === 'V3' ? `V3:${p.base}:${p.fee}` : `V4:${p.base}:${p.fee}:${p.tickSpacing}`;
}

type MulticallResult<T> =
  | { status: 'success'; result: T }
  | { status: 'failure'; error: Error };

/**
 * One pass of the discovery multicall. Returns both what it found and whether any individual
 * probe failed outright -- a probe returning "no pool" is a real, trustworthy success (the zero
 * address / uninitialized slot0 is a deterministic on-chain fact); a probe whose call itself
 * errored is not evidence of anything and must not be read as "no pool" or cached as one.
 */
async function runDiscoveryPass(token: Address): Promise<{ pools: Pool[]; anyFailed: boolean }> {
  const v3Probes: Array<{ base: Address; fee: number }> = [];
  const v4Probes: Array<{ base: Address; fee: number; tickSpacing: number }> = [];
  for (const fee of FEE_TIERS) {
    for (const base of [WETH, USDG] as Address[]) v3Probes.push({ base, fee });
    // Only USDG-quoted v4 pools are routable today: the ETH leg always settles through USDG.
    for (const tickSpacing of tickSpacingCandidates(fee)) v4Probes.push({ base: USDG, fee, tickSpacing });
  }

  // One multicall, not one request per probe: this RPC throttles hard on concurrent calls --
  // which is exactly why individual sub-calls inside it are the ones that go on to fail.
  const results = await publicClient.multicall({
    allowFailure: true,
    contracts: [
      ...v3Probes.map((p) => ({
        address: V3_FACTORY, abi: V3_FACTORY_ABI, functionName: 'getPool',
        args: [p.base, token, p.fee],
      })),
      ...v4Probes.map((p) => {
        const { poolKey } = poolKeyFor(p.base, token, p.fee, p.tickSpacing);
        return {
          address: V4_STATE_VIEW, abi: STATE_VIEW_ABI, functionName: 'getSlot0',
          args: [poolId(poolKey.currency0, poolKey.currency1, p.fee, p.tickSpacing)],
        };
      }),
    ] as any,
  });
  const v3Results = results.slice(0, v3Probes.length) as MulticallResult<Address>[];
  const v4Results = results.slice(v3Probes.length) as MulticallResult<readonly bigint[]>[];

  let anyFailed = false;
  const pools: Pool[] = [];
  v3Results.forEach((r, i) => {
    if (r.status === 'success') {
      if (r.result && r.result !== ZERO_ADDRESS) {
        pools.push({ kind: 'V3', base: v3Probes[i].base, fee: v3Probes[i].fee });
      }
    } else {
      anyFailed = true;
    }
  });
  v4Results.forEach((r, i) => {
    if (r.status === 'success') {
      if (r.result && r.result[0] > 0n) {
        pools.push({ kind: 'V4', base: v4Probes[i].base, fee: v4Probes[i].fee,
                     tickSpacing: v4Probes[i].tickSpacing });
      }
    } else {
      anyFailed = true;
    }
  });

  return { pools, anyFailed };
}

/**
 * Finds every pool that can trade `token`, once, then caches it. Discovery is a burst of ~100+
 * cheap reads in one multicall; on an RPC that throttles hard on concurrency, some of those
 * sub-calls failing outright (not "no pool" -- the call itself erroring) is routine, not
 * exceptional. A first pass that drops a handful of probes to that noise can under-report a
 * token's real pools, sometimes down to zero -- which quoteBuy()/quoteSell() would otherwise read
 * as "not tradable" and this cache would then repeat as fact for a full TTL_MS to every quote
 * request that follows. So: retry once on any failure, and union what both passes found rather
 * than trusting only the second -- a pool a pass actually finds is real regardless of which pass
 * found it; a pass finding fewer pools than another never overrides one that found more.
 */
export async function discoverPools(token: Address): Promise<Pool[]> {
  const key = token.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.pools;

  const first = await runDiscoveryPass(token);
  const pools = first.pools;
  if (first.anyFailed) {
    const second = await runDiscoveryPass(token);
    const seen = new Set(pools.map(poolKey));
    for (const p of second.pools) if (!seen.has(poolKey(p))) { pools.push(p); seen.add(poolKey(p)); }
  }

  cache.set(key, { at: Date.now(), pools });
  return pools;
}
