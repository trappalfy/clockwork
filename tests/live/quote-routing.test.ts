import { describe, it, expect } from 'vitest';
import { parseEther, type Address } from 'viem';
import { quoteBuy } from '@/lib/quote/engine';
import { buildBuyCalldata } from '@/lib/router/encode';
import { publicClient } from '@/lib/chain/client';
import { UNIVERSAL_ROUTER } from '@/lib/chain/addresses';
import { fetchStockAssets } from '@/lib/registry/assets';

const TRADER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;

/**
 * Against live chain state, not mocks. Slower and occasionally noisy for reasons that are nobody's
 * bug (a pool drains, the public RPC throttles) -- see the discoverPools() retry and the
 * "has no on-chain liquidity yet" distinction in lib/quote/engine.ts, both written because of
 * exactly that noise. That's also why this file lives under tests/live and is opt-in: a real
 * router redeploy or a fork-specific field shifting is the one class of bug no unit test can see,
 * because the unit tests assert against the same hand-derived offsets this exists to check.
 */
describe.concurrent('quoteBuy -> buildBuyCalldata against live chain state', () => {
  const SAMPLE = ['NVDA', 'SPY', 'AAPL', 'GME'];

  it.for(SAMPLE)('%s: routes and the router accepts the calldata (eth_call, no funds spent)', async (symbol) => {
    const assets = await fetchStockAssets();
    const asset = assets.find((a) => a.symbol === symbol);
    expect(asset, `${symbol} missing from the live registry`).toBeDefined();

    const route = await quoteBuy(asset!.address as Address, symbol, parseEther('0.05'));
    expect(route.amountOut).toBeGreaterThan(0n);
    expect(['V3', 'V4']).toContain(route.venue);

    const { data, value } = buildBuyCalldata({
      venue: route.venue, amountInWei: parseEther('0.05'), v3Hops: route.v3Hops,
      v3MinOut: route.venue === 'V3' ? (route.amountOut * 99n) / 100n : route.v3Out,
      v4: route.v4 ? {
        token: asset!.address as Address, fee: route.fee, tickSpacing: route.tickSpacing ?? 60,
        currencyIn: route.v4.currencyIn, amountIn: route.v4.amountIn,
        minOut: (route.amountOut * 99n) / 100n,
      } : undefined,
      recipient: TRADER, deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    });

    // The real test: the router actually accepts this calldata against live pool state.
    // A field-order mistake or a redeployed router reverts here, not in a type checker.
    await expect(publicClient.call({
      account: TRADER, to: UNIVERSAL_ROUTER, data, value,
      stateOverride: [{ address: TRADER, balance: parseEther('10') }],
    })).resolves.not.toThrow();
  });

  it('a symbol with zero on-chain liquidity fails with that message, not a generic one', async () => {
    // SATS was confirmed by hand (slot0 present, liquidity() == 0, quoter reverts "SPL") during
    // the September 2026 mainnet-publish investigation. If this ever starts passing, either SATS
    // got real liquidity (great -- swap the symbol below for one that's currently thin) or the
    // distinction in lib/quote/engine.ts's noRouteMessage() regressed silently.
    const assets = await fetchStockAssets();
    const asset = assets.find((a) => a.symbol === 'SATS');
    if (!asset) return; // delisted or renamed since -- not this test's problem to catch
    await expect(quoteBuy(asset.address as Address, 'SATS', parseEther('0.05')))
      .rejects.toThrow(/no on-chain liquidity yet/);
  });
});
