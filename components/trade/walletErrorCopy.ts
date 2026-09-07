/**
 * wagmi writes its errors for whoever builds the app, not whoever uses it:
 * "Provider not found. Version: @wagmi/core@3.6.5" tells a visitor nothing
 * they can act on, and the version footer is a build stamp that has no
 * business on a trading screen.
 *
 * Only the two a real visitor actually hits get their own copy. Anything
 * unmapped still shows — an unexpected error is worth reading — just with
 * the library's version footer trimmed off.
 */
export function walletErrorCopy(raw: string): string {
  if (/provider not found|no injected provider/i.test(raw)) {
    return "No wallet in this browser. Clockwork talks to a wallet that injects itself into the page — MetaMask and the like. Install one and reload; on a phone, open this page inside your wallet's own browser.";
  }
  if (/user rejected|user denied/i.test(raw)) {
    return "You dismissed the request in your wallet. Nothing was signed.";
  }
  return raw.replace(/\s*Version:\s*[\w/.@-]+\s*$/i, "").trim() || raw;
}
