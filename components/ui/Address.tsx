/**
 * The recipient address. This is the one thing FRONTEND.md calls a
 * safety requirement rather than a decoration — it must render large
 * and unconditionally, before signing, in every state of the swap flow.
 * `break-all` is what keeps a solid 42-character string from overflowing
 * narrow screens: with no spaces to wrap on, the browser needs
 * permission to break mid-character instead.
 */
export function Address({
  value,
  label = "Funds arrive at",
  size = "default",
}: {
  value: string;
  label?: string;
  size?: "default" | "large";
}) {
  return (
    <div>
      <p className="font-text text-[var(--text-caption)] text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`font-mono break-all text-[var(--fg)] ${
          size === "large" ? "text-2xl sm:text-3xl" : "text-lg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
