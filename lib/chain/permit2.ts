import { encodeFunctionData, type Address } from 'viem';
import { publicClient } from './client';
import { PERMIT2, UNIVERSAL_ROUTER } from './addresses';

const ERC20_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const PERMIT2_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
    outputs: [{ name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }],
    outputs: [] },
] as const;

const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = (1n << 48n) - 1n;

export interface ApprovalStep {
  label: string;
  to: Address;
  data: `0x${string}`;
  value: '0x0';
}

/**
 * Selling a token requires the Universal Router to pull it from the seller. On this chain that
 * happens through two plain on-chain approvals -- an ERC20 approve to Permit2, then a Permit2
 * approve of the router -- never an off-chain EIP-712 signature. Verified against the reference
 * implementation's own sell flow: it issues these same two calls and nothing else.
 *
 * Returns only the approvals still missing, so a seller who already approved skips straight to
 * the swap.
 */
export async function missingApprovals(token: Address, owner: Address, amount: bigint, symbol: string): Promise<ApprovalStep[]> {
  const [erc20Allowance, permit2Allowance] = await Promise.all([
    publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'allowance', args: [owner, PERMIT2] }),
    publicClient.readContract({ address: PERMIT2, abi: PERMIT2_ABI, functionName: 'allowance', args: [owner, token, UNIVERSAL_ROUTER] }),
  ]);

  const steps: ApprovalStep[] = [];
  if (erc20Allowance < amount) {
    steps.push({
      label: `Allow Permit2 to move ${symbol}`,
      to: token,
      data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [PERMIT2, MAX_UINT256] }),
      value: '0x0',
    });
  }
  const [permitAmount, permitExpiration] = permit2Allowance;
  const expired = BigInt(permitExpiration) * 1000n < BigInt(Date.now());
  if (permitAmount < amount || expired) {
    steps.push({
      label: `Allow the router to spend your ${symbol}`,
      to: PERMIT2,
      data: encodeFunctionData({
        abi: PERMIT2_ABI, functionName: 'approve',
        args: [token, UNIVERSAL_ROUTER, MAX_UINT160, Number(MAX_UINT48)],
      }),
      value: '0x0',
    });
  }
  return steps;
}

export async function tokenBalance(token: Address, owner: Address): Promise<bigint> {
  return publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner] });
}
