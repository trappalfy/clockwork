/**
 * A rule marks a real structural boundary — the edge of a section, the
 * seam between two plates — never a decorative underline. If there's no
 * boundary to mark, there's no reason to place a Rule.
 */
export function Rule({
  variant = "hairline",
  className = "",
}: {
  variant?: "hairline" | "double";
  className?: string;
}) {
  if (variant === "double") {
    return (
      <div
        role="separator"
        aria-hidden="true"
        className={`h-[5px] border-t border-b border-[var(--rule)] ${className}`}
      />
    );
  }
  return (
    <hr
      className={`border-0 border-t border-[var(--rule)] ${className}`}
    />
  );
}
