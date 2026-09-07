const quotes = [
  { symbol: "NVDA", price: "184.20", delta: "+1.8%", up: true },
  { symbol: "AAPL", price: "231.05", delta: "−0.6%", up: false },
  { symbol: "SPY", price: "566.40", delta: "+0.3%", up: true },
];

export function Escapement() {
  return (
    <>
      <h2
        className="font-display mt-4 max-w-[20ch]"
        style={{ fontSize: "var(--text-display-2)", lineHeight: 1.15 }}
      >
        A price, cut the instant it&rsquo;s asked for.
      </h2>
      <p
        className="font-text mt-6 max-w-[62ch]"
        style={{ fontSize: "var(--text-body)", lineHeight: 1.7 }}
      >
        Every quote is pulled fresh from the pools carrying that pair right
        now — not cached, not estimated. Ask again a second later and the
        tape prints a different number, the same way the market does.
      </p>
      <p className="font-mono tabular mt-8 flex flex-wrap gap-x-6 gap-y-1 text-[var(--text-mono)]">
        {quotes.map((q) => (
          <span key={q.symbol} className="whitespace-nowrap">
            {q.symbol} <span>{q.price}</span>{" "}
            <span
              style={{ color: q.up ? "var(--positive)" : "var(--negative)" }}
            >
              {q.up ? "▲" : "▼"} {q.delta}
            </span>
          </span>
        ))}
      </p>
    </>
  );
}
