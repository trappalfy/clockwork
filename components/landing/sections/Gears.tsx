export function Gears() {
  return (
    <>
      <h2
        className="font-display mt-4 max-w-[22ch]"
        style={{ fontSize: "var(--text-display-2)", lineHeight: 1.15 }}
      >
        The route runs through public pools, not around them.
      </h2>
      <p
        className="font-text mt-6 max-w-[62ch]"
        style={{ fontSize: "var(--text-body)", lineHeight: 1.7 }}
      >
        Clockwork compares the Uniswap V3 and V4 pools available for a pair
        and sends the trade through whichever is carrying the best price at
        that moment. Nothing is hidden from the pool, and nothing is hidden
        from you — the same routing anyone could do by hand, done in the
        time it takes to read this line.
      </p>
      <p className="font-display mt-8 tracking-wide" style={{ fontSize: "var(--text-heading)" }}>
        V3 <span className="text-[var(--muted)]">and</span> V4
      </p>
    </>
  );
}
