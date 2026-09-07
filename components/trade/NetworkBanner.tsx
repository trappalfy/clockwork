"use client";

/**
 * Blocks the form rather than letting someone quote or sign on the wrong
 * chain — a quote priced against the wrong network's pools is meaningless,
 * and a signature meant for Robinhood Chain has no business being asked
 * for anywhere else.
 */
export function NetworkBanner({
  onSwitch,
  isSwitching,
}: {
  onSwitch: () => void;
  isSwitching: boolean;
}) {
  return (
    <div className="border border-[var(--negative)] bg-[var(--surface)] px-5 py-4">
      <p
        className="font-text text-[var(--negative)]"
        style={{ fontSize: "var(--text-body-sm)" }}
      >
        Your wallet is on the wrong network. Clockwork only trades on
        Robinhood Chain (4663).
      </p>
      <button
        type="button"
        onClick={onSwitch}
        disabled={isSwitching}
        className="font-text mt-3 border border-[var(--negative)] px-4 py-2 text-[var(--negative)] disabled:opacity-50"
        style={{ fontSize: "var(--text-body-sm)" }}
      >
        {isSwitching ? "Switching…" : "Switch to Robinhood Chain"}
      </button>
    </div>
  );
}
