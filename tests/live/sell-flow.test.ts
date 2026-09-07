import { describe, it, expect } from 'vitest';
import { parseAbiItem, parseUnits, type Address } from 'viem';
import { publicClient } from '@/lib/chain/client';
import { quoteSell, withSlippage } from '@/lib/quote/engine';
import { buildSellCalldata } from '@/lib/router/encode';
import { missingApprovals } from '@/lib/chain/permit2';
import { UNIVERSAL_ROUTER, RPC_URL } from '@/lib/chain/addresses';

const NVDA = '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC' as Address;
// A plain EOA with no code, used only as the ETH recipient in the simulation below -- a contract
// without a receive() function (the router's own V4 pool manager showed up as a false "seller"
// candidate once and made this exact mistake) would fail the UNWRAP_WETH step for a reason that
// has nothing to do with whether the swap itself works.
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const ERC20_BALANCE_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }],
}] as const;

/** A real NVDA holder, found from recent Transfer events -- not a synthetic address. */
async function findHolder(minAmount: bigint): Promise<Address> {
  const latest = await publicClient.getBlockNumber();
  const logs = await publicClient.getLogs({
    address: NVDA, event: TRANSFER, fromBlock: latest - 1_500n, toBlock: 'latest',
  });
  const candidates = [...new Set(logs.map((l) => l.args.to).filter((a): a is Address => !!a))].slice(0, 60);
  const balances = await publicClient.multicall({
    allowFailure: true,
    contracts: candidates.map((c) => ({
      address: NVDA, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [c],
    })),
  });
  const holder = candidates.find((_, i) => {
    const r = balances[i];
    return r.status === 'success' && (r.result as bigint) >= minAmount;
  });
  if (!holder) throw new Error('no recent NVDA holder found in the last 1500 blocks -- widen the search window');
  return holder;
}

/**
 * This is the flow that had never been exercised end-to-end before the September 2026
 * mainnet-publish check: the two-step Permit2 approval a sell requires, then the swap itself,
 * simulated in one state-preserving sequence via eth_simulateV1 against a real holder's real
 * balance. No signature, no funds spent -- but a revert here is a revert a real seller would hit.
 */
describe('sell flow: Permit2 approvals + swap, simulated end to end', () => {
  it('both approvals and the swap succeed in sequence for a real NVDA holder', async () => {
    const amount = parseUnits('1', 18);
    const seller = await findHolder(amount);

    const route = await quoteSell(NVDA, 'NVDA', amount, 100);
    const minEthOut = withSlippage(route.amountOut, 100);
    const { data, value } = buildSellCalldata({
      venue: route.venue, amountInTokens: amount, v3Hops: route.v3Hops, minEthOut,
      v4: route.v4 ? {
        token: NVDA, fee: route.fee, tickSpacing: route.tickSpacing ?? 60,
        currencyOut: route.v4.currencyOut, amountIn: amount,
        minOut: withSlippage(route.v4.amountOut, 100),
      } : undefined,
      recipient: RECIPIENT, deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    });
    const approvals = await missingApprovals(NVDA, seller, amount, 'NVDA');
    expect(approvals.length).toBeGreaterThan(0); // a fresh holder has never approved Permit2 or the router

    const calls = [
      ...approvals.map((a) => ({ from: seller, to: a.to, data: a.data, value: '0x0' })),
      { from: seller, to: UNIVERSAL_ROUTER, data, value: '0x' + value.toString(16) },
    ];

    const res = await fetch(RPC_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_simulateV1',
        params: [{
          blockStateCalls: [{
            // Only for gas -- the seller already holds the token being sold.
            stateOverrides: { [seller]: { balance: '0x56BC75E2D63100000' } },
            calls,
          }],
          validation: false,
        }, 'latest'],
      }),
    });
    const json = await res.json();
    expect(json.error, JSON.stringify(json.error)).toBeUndefined();

    const results = json.result[0].calls as Array<{ status: string; error?: unknown }>;
    expect(results).toHaveLength(approvals.length + 1);
    results.forEach((r, i) => {
      const label = i < approvals.length ? approvals[i].label : 'swap';
      expect(r.status, `${label} reverted: ${JSON.stringify(r.error)}`).toBe('0x1');
    });
  });
});
