"use client";

/**
 * A sale needs a plain approval before the swap itself — the router
 * can't be trusted to spend the token until Permit2 says it may. This
 * makes the two-transaction shape visible instead of leaving someone to
 * wonder why their wallet is asking twice.
 */
export function ApprovalSteps({
  total,
  current,
}: {
  total: number;
  current: number | null;
}) {
  return (
    <div
      className="border border-[var(--rule)] px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <p
        className="font-text text-[var(--muted)]"
        style={{ fontSize: "var(--text-caption)" }}
      >
        Selling this asset takes two on-chain steps: a permit that lets
        Clockwork&rsquo;s router spend the token, then the swap itself.
      </p>
      <ol className="font-mono mt-2 flex gap-4" style={{ fontSize: "var(--text-caption)" }}>
        {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
          <li
            key={step}
            style={{
              color:
                current != null && step <= current
                  ? "var(--accent-text)"
                  : "var(--muted)",
            }}
          >
            Step {step} of {total}
            {current === step ? " — awaiting confirmation" : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
