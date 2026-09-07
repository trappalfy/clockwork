import Link from "next/link";

export function Enter() {
  return (
    <>
      <h2
        className="font-display mt-4 max-w-[16ch]"
        style={{ fontSize: "var(--text-display-2)", lineHeight: 1.15 }}
      >
        Wind it.
      </h2>
      <p
        className="font-text mt-6 max-w-[52ch]"
        style={{ fontSize: "var(--text-body)", lineHeight: 1.7 }}
      >
        The trading screen is a single page: choose a side, watch the quote
        settle, sign once or twice, done. Nothing here asks who you are.
      </p>
      <Link
        href="/app"
        className="mt-10 inline-block border border-[var(--rule)] px-6 py-3 font-text text-[var(--fg)] transition-colors hover:border-[var(--accent-text)] hover:text-[var(--accent-text)]"
        style={{ fontSize: "var(--text-body)" }}
      >
        Open the trading screen
      </Link>
    </>
  );
}
