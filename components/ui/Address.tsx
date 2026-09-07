import { Fragment } from "react";

/**
 * The recipient address, set the way a compositor would set serial
 * numbers: grouped in fours so the eye can check it against a wallet,
 * not read it as prose. This is the one thing FRONTEND.md calls a
 * safety requirement rather than a decoration — it must render large
 * and unconditionally, before signing, in every state of the swap flow.
 */
function groupHex(value: string): { prefix: string; groups: string[] } {
  const hasPrefix = value.startsWith("0x") || value.startsWith("0X");
  const prefix = hasPrefix ? value.slice(0, 2) : "";
  const body = hasPrefix ? value.slice(2) : value;
  return { prefix, groups: body.match(/.{1,4}/g) ?? [] };
}

export function Address({
  value,
  label = "Funds arrive at",
  size = "default",
}: {
  value: string;
  label?: string;
  size?: "default" | "large";
}) {
  const { prefix, groups } = groupHex(value);
  return (
    <div>
      <p className="font-text text-[var(--text-caption)] text-[var(--muted)]">
        {label}
      </p>
      <p
        aria-label={value}
        className={`font-mono break-all text-[var(--fg)] ${
          size === "large" ? "text-2xl sm:text-3xl" : "text-lg"
        }`}
      >
        {/* The space between groups is a plain text node, not part of
            either span — that's the only place the browser is allowed to
            wrap. A space living inside a whitespace-nowrap span glues two
            groups into one unbreakable run and overflows narrow screens. */}
        <span className="whitespace-nowrap">{prefix}{groups[0]}</span>
        {groups.slice(1).map((group, i) => (
          <Fragment key={i}>
            {" "}
            <span className="whitespace-nowrap">{group}</span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
