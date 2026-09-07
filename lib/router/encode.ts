import { type Address, type Hex, encodeAbiParameters, encodeFunctionData, concat, pad, toHex } from 'viem';
import { ADDRESS_THIS, USDG } from '../chain/addresses';

/** Universal Router command bytes. */
export const Command = {
  V3_SWAP_EXACT_IN: 0x00,
  SWEEP: 0x04,
  WRAP_ETH: 0x0b,
  UNWRAP_WETH: 0x0c,
  V4_SWAP: 0x10,
} as const;

/** Uniswap v4 action bytes. */
export const V4Action = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SETTLE: 0x0b,
  TAKE_ALL: 0x0f,
} as const;

const EXECUTE_ABI = [{
  name: 'execute', type: 'function', stateMutability: 'payable',
  inputs: [
    { name: 'commands', type: 'bytes' },
    { name: 'inputs', type: 'bytes[]' },
    { name: 'deadline', type: 'uint256' },
  ],
  outputs: [],
}] as const;

/**
 * V3_SWAP_EXACT_IN input as deployed on Robinhood Chain.
 *
 * Fork extension: a trailing `minHopPricesX36` array after `payerIsUser`, sent empty. Confirmed by
 * offset arithmetic against live router calldata -- the path pointer reads 0xc0 where the canonical
 * five-field layout would put 0xa0, and the array pointer lands exactly where six head words predict.
 */
const V3_SWAP_EXACT_IN_ABI = [
  { type: 'address' }, { type: 'uint256' }, { type: 'uint256' },
  { type: 'bytes' }, { type: 'bool' }, { type: 'uint256[]' },
] as const;

/**
 * ExactInputSingleParams as deployed on Robinhood Chain.
 *
 * Same fork: an extra `minHopPriceX36` word sits between `amountOutMinimum` and `hookData`. The
 * hookData pointer reads 320 (word 10 of the struct) where the canonical layout would put 288.
 * Encoding either struct with the stock Uniswap SDK yields calldata that reverts on this chain.
 */
const EXACT_IN_SINGLE_ABI = [{
  type: 'tuple',
  components: [
    { name: 'poolKey', type: 'tuple', components: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ]},
    { name: 'zeroForOne', type: 'bool' },
    { name: 'amountIn', type: 'uint128' },
    { name: 'amountOutMinimum', type: 'uint128' },
    { name: 'minHopPriceX36', type: 'uint256' },
    { name: 'hookData', type: 'bytes' },
  ],
}] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

const commandBytes = (cmds: number[]): Hex =>
  `0x${cmds.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** Packed V3 path: token, fee(3 bytes), token, [fee, token...] */
export function encodeV3Path(hops: V3Hops): Hex {
  return concat(hops.map((h) =>
    typeof h === 'number' ? pad(toHex(h), { size: 3 }) : (h.toLowerCase() as Hex),
  ));
}

/** V3 leg described as [tokenIn, fee, tokenOut, fee, tokenOut, ...]. */
export type V3Hops = Array<Address | number>;

export interface V4Leg {
  /** Token bought on the v4 pool. */
  token: Address;
  fee: number;
  tickSpacing: number;
  /** Currency paid into the v4 pool (the V3 leg's output). */
  currencyIn: Address;
  amountIn: bigint;
  minOut: bigint;
}

export interface BuyParams {
  /** V3 for a pure V3 route, V4 when the final hop settles on a v4 pool. */
  venue: 'V3' | 'V4';
  /** ETH being spent, in wei. */
  amountInWei: bigint;
  /** V3 leg hops. Ends at the bought token for a V3 route, at the v4 leg's input otherwise. */
  v3Hops: V3Hops;
  /** Minimum output of the V3 leg, in that token's units. */
  v3MinOut: bigint;
  /** Required when venue is V4. */
  v4?: V4Leg;
  recipient: Address;
  deadline: bigint;
}

/** Builds Universal Router calldata for an ETH -> tokenized stock buy. */
export function buildBuyCalldata(p: BuyParams): { data: Hex; value: bigint } {
  const commands: number[] = [Command.WRAP_ETH];
  const inputs: Hex[] = [
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [ADDRESS_THIS, p.amountInWei]),
  ];

  // The V3 leg pays the user directly on a pure V3 route, otherwise it funds the router for v4.
  const v3Recipient = p.venue === 'V3' ? p.recipient : ADDRESS_THIS;
  commands.push(Command.V3_SWAP_EXACT_IN);
  inputs.push(encodeAbiParameters(V3_SWAP_EXACT_IN_ABI,
    [v3Recipient, p.amountInWei, p.v3MinOut, encodeV3Path(p.v3Hops), false, []]));

  if (p.venue === 'V4') {
    if (!p.v4) throw new Error('v4 route requires a v4 leg');
    const { token, fee, tickSpacing, currencyIn, amountIn, minOut } = p.v4;
    commands.push(Command.V4_SWAP, Command.SWEEP);

    // v4 orders pool currencies by address; zeroForOne says which side we are paying in.
    const zeroForOne = currencyIn.toLowerCase() < token.toLowerCase();
    const [currency0, currency1] = zeroForOne ? [currencyIn, token] : [token, currencyIn];

    const swap = encodeAbiParameters(EXACT_IN_SINGLE_ABI, [{
      poolKey: { currency0, currency1, fee, tickSpacing, hooks: ZERO_ADDRESS },
      zeroForOne, amountIn, amountOutMinimum: minOut, minHopPriceX36: 0n, hookData: '0x' as Hex,
    }]);
    const settle = encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bool' }], [currencyIn, 0n, false]);
    const takeAll = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [token, minOut]);

    inputs.push(encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }],
      [commandBytes([V4Action.SWAP_EXACT_IN_SINGLE, V4Action.SETTLE, V4Action.TAKE_ALL]),
       [swap, settle, takeAll]]));

    // Whatever the v4 leg did not consume goes back to the user rather than sitting in the router.
    inputs.push(encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], [currencyIn, p.recipient, 0n]));
  }

  return {
    data: encodeFunctionData({
      abi: EXECUTE_ABI, functionName: 'execute',
      args: [commandBytes(commands), inputs, p.deadline],
    }),
    value: p.amountInWei,
  };
}

export { USDG };

/**
 * Uniswap v4 action bytes used only on the sell path: SETTLE_ALL pays the exact amount owed for a
 * currency (here, pulling the sold token from the seller via Permit2), TAKE moves a currency to a
 * chosen recipient rather than always the router's own context the way TAKE_ALL does.
 */
export const V4SellAction = {
  SETTLE_ALL: 0x0c,
  TAKE: 0x0e,
} as const;

export interface V4SellLeg {
  /** Token being sold on the v4 pool. */
  token: Address;
  fee: number;
  tickSpacing: number;
  /** Currency the v4 pool pays out (feeds the V3 leg that follows). */
  currencyOut: Address;
  amountIn: bigint;
  /**
   * Slippage-adjusted minimum output of this hop -- never zero. Universal Router commands take
   * literal amounts, not a reference to a prior command's actual result, so this floor is used
   * TWICE: as the v4 swap's own `amountOutMinimum`, and as the following V3 leg's `amountIn`. That
   * makes the V3 leg spend only what the v4 leg is guaranteed to have delivered, never what it
   * merely expects to -- any surplus above the floor is swept back to the seller afterwards. The
   * reference implementation instead hardcodes its own off-chain price estimate as that amountIn
   * with no v4 floor at all, which both leaves the trade unprotected and can revert on ordinary
   * price movement between quote and execution.
   */
  minOut: bigint;
}

export interface SellParams {
  venue: 'V3' | 'V4';
  /** Token amount being sold, in that token's units. */
  amountInTokens: bigint;
  /**
   * V3 leg hops. For a V3 route this runs token -> ... -> WETH, paid by the seller via Permit2.
   * For a V4 route this runs the v4 leg's output -> WETH, paid from the router's own balance.
   */
  v3Hops: V3Hops;
  /** Slippage-adjusted minimum ETH out of the whole trade -- never zero. */
  minEthOut: bigint;
  /** Required when venue is V4. */
  v4?: V4SellLeg;
  recipient: Address;
  deadline: bigint;
}

/**
 * Builds Universal Router calldata for a tokenized-stock -> ETH sell.
 *
 * Requires Permit2 to already hold an on-chain allowance for the router (see
 * `lib/chain/permit2.ts`) -- no EIP-712 signature is embedded here, matching how the reference
 * implementation's own sell flow works.
 *
 * Every minimum here is a real, slippage-adjusted floor. The reference implementation sends zero
 * for all of them, which leaves a seller's execution price completely unprotected; we do not
 * repeat that.
 */
export function buildSellCalldata(p: SellParams): { data: Hex; value: bigint } {
  const commands: number[] = [];
  const inputs: Hex[] = [];

  if (p.venue === 'V3') {
    commands.push(Command.V3_SWAP_EXACT_IN);
    inputs.push(encodeAbiParameters(V3_SWAP_EXACT_IN_ABI,
      [ADDRESS_THIS, p.amountInTokens, p.minEthOut, encodeV3Path(p.v3Hops), true, []]));
  } else {
    if (!p.v4) throw new Error('v4 route requires a v4 leg');
    const { token, fee, tickSpacing, currencyOut, amountIn, minOut } = p.v4;
    commands.push(Command.V4_SWAP);

    const zeroForOne = token.toLowerCase() < currencyOut.toLowerCase();
    const [currency0, currency1] = zeroForOne ? [token, currencyOut] : [currencyOut, token];

    const swap = encodeAbiParameters(EXACT_IN_SINGLE_ABI, [{
      poolKey: { currency0, currency1, fee, tickSpacing, hooks: ZERO_ADDRESS },
      zeroForOne, amountIn, amountOutMinimum: minOut, minHopPriceX36: 0n, hookData: '0x' as Hex,
    }]);
    // Pulls `token` from the seller via Permit2 -- this is what the on-chain Permit2 approval enables.
    const settleAll = encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }], [token, amountIn]);
    // amount 0 is the v4 "open delta" sentinel: take whatever the swap actually produced.
    const take = encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], [currencyOut, ADDRESS_THIS, 0n]);

    inputs.push(encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }],
      [commandBytes([V4Action.SWAP_EXACT_IN_SINGLE, V4SellAction.SETTLE_ALL, V4SellAction.TAKE]),
       [swap, settleAll, take]]));

    commands.push(Command.V3_SWAP_EXACT_IN);
    inputs.push(encodeAbiParameters(V3_SWAP_EXACT_IN_ABI,
      [ADDRESS_THIS, minOut, p.minEthOut, encodeV3Path(p.v3Hops), false, []]));
  }

  commands.push(Command.UNWRAP_WETH);
  inputs.push(encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }], [p.recipient, p.minEthOut]));

  if (p.venue === 'V4') {
    // Dust guard: the V3 leg is sized to consume exactly the v4 leg's output, so this is normally
    // zero, but a real floor here would be wrong -- any leftover belongs to the seller, not the router.
    commands.push(Command.SWEEP);
    inputs.push(encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }],
      [p.v4!.currencyOut, p.recipient, 0n]));
  }

  return {
    data: encodeFunctionData({
      abi: EXECUTE_ABI, functionName: 'execute',
      args: [commandBytes(commands), inputs, p.deadline],
    }),
    value: 0n,
  };
}
