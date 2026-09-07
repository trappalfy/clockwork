# Clockwork

Trade tokenized equities on Robinhood Chain (chain id `4663`). Connect a wallet, swap
ETH for a tokenized stock or back — NVDA, AAPL, SPY, and roughly ninety others — routed
through public Uniswap V3/V4 pools and settled straight to your own wallet. No account,
no custody: the server only ever hands back a transaction for your wallet to sign.

Live at **[clockwork-nu-kohl.vercel.app](https://clockwork-nu-kohl.vercel.app)**.

## Layout

Two halves of one Next.js app, deliberately isolated from each other:

- **Landing** (`app/page.tsx`, `components/landing/**`) — the pitch, plus a pinned
  react-three-fiber scene over the first three sections. No wallet connector in its
  bundle; see `FRONTEND.md` for why and how that's enforced.
- **Trade screen** (`app/app/**`, `components/trade/**`) — the actual swap form, built
  on the hooks below. No third-party scripts of any kind: this is where transactions
  get signed.
- **Chain layer** (`lib/**`, `hooks/**`, `app/api/**`) — pool discovery, quoting, and
  Universal Router calldata encoding. The router on this chain is a *fork* with extra
  struct fields; see the ABI comments in `lib/router/encode.ts` before touching it.

`FRONTEND.md` is the living brief for whoever's working on the landing/trade split —
read it before starting frontend work, it tracks what's done and what each zone owns.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are
needed — chain RPC, contract addresses, and Robinhood's public asset/price API are all
hardcoded constants in `lib/chain/addresses.ts` and `lib/registry/assets.ts`.

## Testing

```bash
npm test        # unit: calldata encoding, slippage math, pool-key derivation. No network.
npm run test:live   # + integration: real quotes and eth_call/eth_simulateV1 simulations
                     # against live chain state. Slower, can be flaky under RPC rate limits
                     # that are nobody's bug — see the retry logic in lib/pools/discovery.ts
                     # and lib/registry/assets.ts. Never signs or sends a real transaction.
```

`npm test` is what should run before every change to `lib/**`. The unit suite in
particular guards the fork-specific ABI layouts in `lib/router/encode.ts` — the ones
Uniswap's canonical struct definitions get wrong on this chain — so a "cleanup" that
quietly reverts them back to the stock layout fails loudly instead of shipping a swap
that reverts on-chain.

`scripts/*.ts` are one-off diagnostic probes used during development (`npx tsx
scripts/<name>.ts`), not a regression suite — that's what `tests/` is for.

## Deploying

```bash
vercel login   # once, per machine
vercel --prod
```

No env vars to configure. The project is already linked to
[github.com/trappalfy/clockwork](https://github.com/trappalfy/clockwork); a push to
`main` redeploys automatically via Vercel's GitHub integration.

## What's not done yet

Recorded here rather than left implicit — see git history and `FRONTEND.md` for
detail as this changes:

- No security review has run against this codebase.
- Branding is minimal (a brand mark exists; no wider identity/social assets).
- 8 of 194 registry-listed assets have a deployed pool with zero on-chain liquidity
  (confirmed by hand, not a bug) — they fail a quote with a clear message rather than
  routing.
