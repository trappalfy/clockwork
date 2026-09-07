"use client";

import type { SwapStatus } from "@/hooks/useSwap";

const COPY: Record<Exclude<SwapStatus, "idle" | "approving">, string> = {
  signing: "Confirm the swap in your wallet.",
  pending: "Transaction sent — waiting for the network.",
  success: "Done. The swap settled on-chain.",
  error: "The swap didn't go through.",
};

/** One line, in the interface's own voice — never an apology, never vague about what happened. */
export function StatusMessage({
  status,
  txHash,
  error,
}: {
  status: SwapStatus;
  txHash: string | null;
  error: string | null;
}) {
  if (status === "idle" || status === "approving") return null;

  const color =
    status === "success"
      ? "var(--positive)"
      : status === "error"
        ? "var(--negative)"
        : "var(--fg)";

  // Signing/pending/success are transient progress, announced without
  // interrupting whatever the screen reader is already reading. An
  // error on a form that signs real transactions gets the assertive
  // treatment instead — role="alert" implies aria-live="assertive".
  const liveProps =
    status === "error"
      ? { role: "alert" as const }
      : { role: "status" as const, "aria-live": "polite" as const };

  return (
    <div className="border border-[var(--rule)] px-4 py-3" {...liveProps}>
      <p className="font-text" style={{ fontSize: "var(--text-body-sm)", color }}>
        {status === "error" && error ? error : COPY[status]}
      </p>
      {txHash ? (
        <p
          className="font-mono mt-1 break-all text-[var(--muted)]"
          style={{ fontSize: "var(--text-caption)" }}
        >
          {txHash}
        </p>
      ) : null}
    </div>
  );
}
