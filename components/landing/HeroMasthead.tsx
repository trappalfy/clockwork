/**
 * The wordmark and dek. Split out from Hero so the rich (WebGL) path
 * can overlay the same markup on the pinned scene and fade it as the
 * mechanism winds up, while the plain path keeps it as static text —
 * one piece of copy, two places it can live.
 */
export function HeroMasthead() {
  return (
    <>
      <h1
        className="font-display text-center"
        style={{ fontSize: "var(--text-display-1)", lineHeight: 1.05 }}
      >
        Clockwork
      </h1>
      <p
        className="font-text mx-auto mt-6 max-w-[46ch] text-center"
        style={{ fontSize: "var(--text-body)", lineHeight: 1.7 }}
      >
        A mechanism for trading tokenized equities — NVDA, AAPL, SPY, and
        roughly ninety more — routed through public liquidity and settled
        straight into your wallet.
      </p>
    </>
  );
}
