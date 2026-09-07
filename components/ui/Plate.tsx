import type { ReactNode } from "react";

/**
 * A full-bleed inversion of the page — the machine struck in negative,
 * like an engraving plate. It sets no colours of its own: it flips the
 * semantic tokens (see .plate in app/tokens.css) so anything inside —
 * text, rules, a Fleuron — renders correctly without knowing it's on a
 * dark ground.
 */
export function Plate({
  children,
  as: Tag = "section",
  className = "",
}: {
  children: ReactNode;
  as?: "section" | "div" | "footer";
  className?: string;
}) {
  return (
    <Tag className={`plate ${className}`}>
      <div className="mx-auto max-w-5xl px-6 py-24 sm:px-10">{children}</div>
    </Tag>
  );
}
