/**
 * A number pulled from the copy itself, not a decorative KPI card. Used
 * twice on the whole page (Press, Tape) — sparingly enough that it reads
 * as a fact worth noticing rather than a template applied to every
 * section.
 */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="mt-10 flex items-baseline gap-4">
      <span
        className="font-display tabular"
        style={{ fontSize: "var(--text-display-2)" }}
      >
        {value}
      </span>
      <span
        className="font-text text-[var(--muted)]"
        style={{ fontSize: "var(--text-body-sm)" }}
      >
        {label}
      </span>
    </div>
  );
}
