import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Two suites, deliberately separated.
 *
 * `npm test` runs only the pure tests: no network, no RPC, deterministic, fast enough to run on
 * every change. They lock down the encoding and arithmetic that decide what a user actually signs.
 *
 * `npm run test:live` additionally runs tests/live/**, which price and simulate real routes against
 * Robinhood Chain. Those are slow, rate-limited and can fail for reasons that are nobody's bug (a
 * pool drains, the RPC throttles), so they are opt-in rather than part of the default run -- but
 * they are the only thing that catches a fork-specific ABI drift or a router redeploy, which no
 * amount of mocking would.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: process.env.LIVE
      ? ['tests/**/*.test.ts']
      : ['tests/unit/**/*.test.ts'],
    testTimeout: process.env.LIVE ? 120_000 : 5_000,
    hookTimeout: process.env.LIVE ? 120_000 : 5_000,
  },
});
