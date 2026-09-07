import { describe, it, expect } from 'vitest';
import { parseEther } from 'viem';
import { withSlippage } from '@/lib/quote/engine';
import { poolId, tickSpacingCandidates, FEE_TIERS } from '@/lib/pools/discovery';
import { USDG, WETH } from '@/lib/chain/addresses';

describe('withSlippage', () => {
  it('subtracts the tolerance in basis points', () => {
    expect(withSlippage(10_000n, 100)).toBe(9_900n);   // 1%
    expect(withSlippage(10_000n, 50)).toBe(9_950n);    // 0.5%
    expect(withSlippage(10_000n, 10)).toBe(9_990n);    // 0.1%
  });

  it('is the identity at zero tolerance', () => {
    expect(withSlippage(parseEther('1'), 0)).toBe(parseEther('1'));
  });

  it('never rounds the floor up -- the user is quoted no more than the contract enforces', () => {
    // 7 wei at 1% is 6.93, which must floor to 6, never round to 7.
    expect(withSlippage(7n, 100)).toBe(6n);
    // Same shape at a size where a rounding bug would be invisible in a UI but real on-chain.
    const out = withSlippage(parseEther('0.05'), 100);
    expect(out).toBe(49_500_000_000_000_000n);
    expect(out).toBeLessThan(parseEther('0.05'));
  });

  it('handles zero without dividing by anything', () => {
    expect(withSlippage(0n, 100)).toBe(0n);
  });

  it('stays exact at wei scale rather than drifting through a float', () => {
    const big = 123_456_789_012_345_678_901n;
    expect(withSlippage(big, 100)).toBe((big * 9_900n) / 10_000n);
  });
});

describe('tickSpacingCandidates', () => {
  it('offers fee/50 and fee/100', () => {
    expect(tickSpacingCandidates(3000).sort((a, b) => a - b)).toEqual([30, 60]);
    expect(tickSpacingCandidates(10000).sort((a, b) => a - b)).toEqual([100, 200]);
  });

  it('drops non-integer and out-of-range spacings', () => {
    // 100/50 = 2 and 100/100 = 1, both valid.
    expect(tickSpacingCandidates(100).sort((a, b) => a - b)).toEqual([1, 2]);
    // Anything above the int24 tick-spacing ceiling is not a real pool key.
    expect(tickSpacingCandidates(10_000_000).every((n) => n <= 32767)).toBe(true);
  });

  it('deduplicates when both divisors agree', () => {
    for (const fee of FEE_TIERS) {
      const c = tickSpacingCandidates(fee);
      expect(new Set(c).size).toBe(c.length);
    }
  });
});

describe('poolId', () => {
  it('is deterministic for the same key', () => {
    const a = poolId(USDG, WETH, 3000, 60);
    const b = poolId(USDG, WETH, 3000, 60);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('changes with every component of the key', () => {
    const base = poolId(USDG, WETH, 3000, 60);
    expect(poolId(WETH, USDG, 3000, 60)).not.toBe(base); // currency order matters
    expect(poolId(USDG, WETH, 500, 60)).not.toBe(base);  // fee
    expect(poolId(USDG, WETH, 3000, 30)).not.toBe(base); // tick spacing
  });
});

describe('FEE_TIERS', () => {
  it('covers the tiers the live pools actually use', () => {
    // Every tier observed carrying a real WETH/USDG-quoted pool during the September 2026 sweep.
    for (const fee of [100, 500, 3000, 10000]) {
      expect(FEE_TIERS).toContain(fee);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(FEE_TIERS).size).toBe(FEE_TIERS.length);
  });
});
