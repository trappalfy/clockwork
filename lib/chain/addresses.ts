import { getAddress, type Address } from 'viem';

export const CHAIN_ID = 4663;
export const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com/';
export const EXPLORER = 'https://robinhoodchain.blockscout.com';

// Every address below is run through getAddress() once, at module load, rather than trusted as a
// literal: several of these were transcribed from lowercase docs/API output with the wrong EIP-55
// checksum, which viem accepts as a *string* but rejects the moment it's used as a strictly-typed
// address argument (e.g. inside readContract args) -- a failure mode that only showed up on the
// sell path, not buy, purely because of which call sites happened to trigger strict validation.
const addr = (a: string): Address => getAddress(a);

export const UNIVERSAL_ROUTER = addr('0x8876789976deCbfcbBBE364623c63652DB8C0904');
export const PERMIT2 = addr('0x000000000022D473030F116dDEE9F6B43aC78BA3');
export const V3_FACTORY = addr('0x1f7d7550b1b028f7571e69a784071f0205fd2efa');
export const QUOTER_V2 = addr('0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7');

export const USDG = addr('0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168');
export const WETH = addr('0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73');
export const USDG_DECIMALS = 6;

/** Universal Router recipient sentinels (see Constants.sol). */
export const MSG_SENDER = addr('0x0000000000000000000000000000000000000001');
export const ADDRESS_THIS = addr('0x0000000000000000000000000000000000000002');

/** WETH/USDG pool fee tier used for the ETH leg (0.01%), observed on-chain. */
export const ETH_USDG_FEE = 100;

/** Uniswap v4 on Robinhood Chain. */
export const V4_POOL_MANAGER = addr('0x8366a39cc670b4001a1121b8f6a443a643e40951');
export const V4_POSITION_MANAGER = addr('0x58daec3116aae6d93017baaea7749052e8a04fa7');
export const V4_STATE_VIEW = addr('0xf3334192d15450cdd385c8b70e03f9a6bd9e673b');
export const V4_QUOTER = addr('0x8dc178efb8111bb0973dd9d722ebeff267c98f94');

/** Canonical Multicall3, deployed at the usual address on this chain. */
export const MULTICALL3 = addr('0xcA11bde05977b3631167028862bE2a173976CA11');
