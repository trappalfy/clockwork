import { describe, it, expect } from 'vitest';
import { decodeFunctionData, decodeAbiParameters, parseEther, type Address, type Hex } from 'viem';
import { buildBuyCalldata, buildSellCalldata, encodeV3Path, Command } from '@/lib/router/encode';
import { WETH, USDG, ETH_USDG_FEE, UNIVERSAL_ROUTER } from '@/lib/chain/addresses';

const TOKEN = '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC' as Address;
const USER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
const DEADLINE = 1_800_000_000n;

const EXECUTE_ABI = [{
  name: 'execute', type: 'function', stateMutability: 'payable',
  inputs: [
    { name: 'commands', type: 'bytes' },
    { name: 'inputs', type: 'bytes[]' },
    { name: 'deadline', type: 'uint256' },
  ],
  outputs: [],
}] as const;

function decodeExecute(data: Hex) {
  const { functionName, args } = decodeFunctionData({ abi: EXECUTE_ABI, data });
  const [commands, inputs, deadline] = args as [Hex, readonly Hex[], bigint];
  return { functionName, commands, inputs, deadline };
}

/** Reads the nth 32-byte word of an ABI blob as a number. */
function word(blob: Hex, n: number): number {
  const hex = blob.slice(2 + n * 64, 2 + (n + 1) * 64);
  return Number(BigInt('0x' + hex));
}

describe('encodeV3Path', () => {
  it('packs address, 3-byte fee, address with no padding between', () => {
    const path = encodeV3Path([WETH, ETH_USDG_FEE, USDG]);
    // 20 + 3 + 20 bytes = 43 bytes = 86 hex chars
    expect(path.length).toBe(2 + 86);
    expect(path.startsWith(WETH.toLowerCase())).toBe(true);
    expect(path.endsWith(USDG.toLowerCase().slice(2))).toBe(true);
  });

  it('lowercases addresses so the packed path is checksum-independent', () => {
    expect(encodeV3Path([TOKEN, 500, WETH])).toBe(encodeV3Path([
      TOKEN.toLowerCase() as Address, 500, WETH.toLowerCase() as Address,
    ]));
  });

  it('encodes the fee as exactly 3 bytes', () => {
    const path = encodeV3Path([WETH, 3000, USDG]);
    const feeHex = path.slice(2 + 40, 2 + 40 + 6);
    expect(feeHex).toBe('000bb8'); // 3000
  });

  it('supports multi-hop paths', () => {
    const path = encodeV3Path([WETH, ETH_USDG_FEE, USDG, 500, TOKEN]);
    // 20 + 3 + 20 + 3 + 20 = 66 bytes
    expect(path.length).toBe(2 + 132);
  });
});

describe('buildBuyCalldata', () => {
  const base = {
    amountInWei: parseEther('0.05'),
    v3MinOut: 1_000n,
    recipient: USER,
    deadline: DEADLINE,
  };

  it('calls execute() and forwards the ETH as msg.value', () => {
    const { data, value } = buildBuyCalldata({
      ...base, venue: 'V3', v3Hops: [WETH, 500, TOKEN],
    });
    const { functionName, deadline } = decodeExecute(data);
    expect(functionName).toBe('execute');
    expect(deadline).toBe(DEADLINE);
    expect(value).toBe(parseEther('0.05'));
  });

  it('a V3 buy is exactly WRAP_ETH then V3_SWAP_EXACT_IN', () => {
    const { data } = buildBuyCalldata({ ...base, venue: 'V3', v3Hops: [WETH, 500, TOKEN] });
    const { commands, inputs } = decodeExecute(data);
    expect(commands).toBe('0x0b00');
    expect(commands).toBe(
      `0x${Command.WRAP_ETH.toString(16).padStart(2, '0')}${Command.V3_SWAP_EXACT_IN.toString(16).padStart(2, '0')}`,
    );
    expect(inputs).toHaveLength(2);
  });

  it('a V4 buy appends V4_SWAP and SWEEP', () => {
    const { data } = buildBuyCalldata({
      ...base, venue: 'V4', v3Hops: [WETH, ETH_USDG_FEE, USDG],
      v4: { token: TOKEN, fee: 3000, tickSpacing: 60, currencyIn: USDG, amountIn: 1_000n, minOut: 1n },
    });
    const { commands, inputs } = decodeExecute(data);
    expect(commands).toBe('0x0b001004');
    expect(inputs).toHaveLength(4);
  });

  it('throws rather than encoding a V4 route with no v4 leg', () => {
    expect(() => buildBuyCalldata({ ...base, venue: 'V4', v3Hops: [WETH, 500, TOKEN] }))
      .toThrow(/v4 leg/i);
  });

  it('pays the user directly on a V3 route, and the router on a V4 route', () => {
    const v3 = decodeExecute(buildBuyCalldata({ ...base, venue: 'V3', v3Hops: [WETH, 500, TOKEN] }).data);
    const v4 = decodeExecute(buildBuyCalldata({
      ...base, venue: 'V4', v3Hops: [WETH, ETH_USDG_FEE, USDG],
      v4: { token: TOKEN, fee: 3000, tickSpacing: 60, currencyIn: USDG, amountIn: 1_000n, minOut: 1n },
    }).data);
    // First head word of the V3 swap input is the recipient.
    const v3Recipient = '0x' + v3.inputs[1].slice(2 + 24, 2 + 64);
    const v4Recipient = '0x' + v4.inputs[1].slice(2 + 24, 2 + 64);
    expect(v3Recipient.toLowerCase()).toBe(USER.toLowerCase());
    // ADDRESS_THIS sentinel, not the user.
    expect(v4Recipient.toLowerCase()).toBe('0x0000000000000000000000000000000000000002');
  });
});

describe('buildSellCalldata', () => {
  const base = {
    amountInTokens: 10n ** 18n,
    minEthOut: 1_000n,
    recipient: USER,
    deadline: DEADLINE,
  };

  it('sends no ETH -- a sell spends tokens, not value', () => {
    const { value } = buildSellCalldata({ ...base, venue: 'V3', v3Hops: [TOKEN, 500, WETH] });
    expect(value).toBe(0n);
  });

  it('a V3 sell is V3_SWAP_EXACT_IN then UNWRAP_WETH', () => {
    const { data } = buildSellCalldata({ ...base, venue: 'V3', v3Hops: [TOKEN, 500, WETH] });
    const { commands } = decodeExecute(data);
    expect(commands).toBe('0x000c');
  });

  it('takes payment from the seller (payerIsUser = true), unlike a buy', () => {
    const sell = decodeExecute(buildSellCalldata({ ...base, venue: 'V3', v3Hops: [TOKEN, 500, WETH] }).data);
    const buy = decodeExecute(buildBuyCalldata({
      venue: 'V3', amountInWei: parseEther('0.05'), v3MinOut: 1n,
      v3Hops: [WETH, 500, TOKEN], recipient: USER, deadline: DEADLINE,
    }).data);
    // Word 4 of the V3 swap input is the payerIsUser bool. A sell pulls the token from the
    // seller via Permit2; a buy spends WETH the router already wrapped and holds itself.
    expect(word(sell.inputs[0], 4)).toBe(1);
    expect(word(buy.inputs[1], 4)).toBe(0);
  });
});

/**
 * The router on this chain is a fork with extra struct fields. Encoding either struct with the
 * canonical Uniswap layout produces calldata that reverts on-chain, and it reverts at execution
 * time with no compile-time or type-level warning -- so these two offsets are the only cheap thing
 * standing between a "cleanup" that adopts the stock layout and silently broken swaps in
 * production. See the ABI comments in lib/router/encode.ts.
 */
describe('fork-specific ABI layout (guards against "fixing" it to canonical Uniswap)', () => {
  it('V3_SWAP_EXACT_IN carries a trailing array, putting the path pointer at 0xc0 not 0xa0', () => {
    const { data } = buildBuyCalldata({
      venue: 'V3', amountInWei: parseEther('0.05'), v3MinOut: 1n,
      v3Hops: [WETH, 500, TOKEN], recipient: USER, deadline: DEADLINE,
    });
    const { inputs } = decodeExecute(data);
    // Head: recipient, amountIn, amountOutMin, ->path, payerIsUser, ->minHopPricesX36 = 6 words.
    expect(word(inputs[1], 3)).toBe(0xc0);
    expect(word(inputs[1], 3)).not.toBe(0xa0); // the canonical five-field layout
  });

  it('the trailing minHopPricesX36 array is present and empty', () => {
    const { data } = buildBuyCalldata({
      venue: 'V3', amountInWei: parseEther('0.05'), v3MinOut: 1n,
      v3Hops: [WETH, 500, TOKEN], recipient: USER, deadline: DEADLINE,
    });
    const { inputs } = decodeExecute(data);
    const decoded = decodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' },
       { type: 'bytes' }, { type: 'bool' }, { type: 'uint256[]' }],
      inputs[1],
    );
    expect(decoded[5]).toEqual([]);
  });

  it('ExactInputSingle carries minHopPriceX36, putting the hookData pointer at 320 not 288', () => {
    const { data } = buildBuyCalldata({
      venue: 'V4', amountInWei: parseEther('0.05'), v3MinOut: 1n,
      v3Hops: [WETH, ETH_USDG_FEE, USDG],
      v4: { token: TOKEN, fee: 3000, tickSpacing: 60, currencyIn: USDG, amountIn: 1_000n, minOut: 1n },
      recipient: USER, deadline: DEADLINE,
    });
    const { inputs } = decodeExecute(data);
    // inputs[2] is (bytes actions, bytes[] params); params[0] is the swap struct.
    const [, params] = decodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes[]' }], inputs[2],
    ) as [Hex, readonly Hex[]];
    const swap = params[0];
    // Word 0 is the offset to the tuple (0x20); the tuple's own head follows.
    expect(word(swap, 0)).toBe(0x20);
    // poolKey(5) + zeroForOne + amountIn + amountOutMinimum + minHopPriceX36 = 9 words,
    // so hookData's pointer is the 10th word of the tuple and reads 320.
    expect(word(swap, 1 + 9)).toBe(320);
    expect(word(swap, 1 + 9)).not.toBe(288); // canonical layout, without minHopPriceX36
  });
});

describe('router address', () => {
  it('is checksummed, so viem accepts it as a strict Address argument', () => {
    // lib/chain/addresses.ts runs every address through getAddress() at module load precisely
    // because a mis-checksummed literal only fails at the call site, and only on some paths.
    expect(UNIVERSAL_ROUTER).toBe('0x8876789976dEcBfCbBbe364623C63652db8C0904');
  });
});
