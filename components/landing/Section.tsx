import type { ReactNode } from "react";
import { Rule } from "@/components/ui/Rule";
import { Fleuron } from "@/components/ui/Fleuron";

/**
 * One stage of the mechanism. A plain Rule opens every section — it
 * marks a real boundary, nothing more. The Fleuron is reserved for a
 * single section (ornament=true): the one threshold on the page that
 * actually matters, where the story stops explaining and the page asks
 * for action. Used everywhere, it would stop meaning anything.
 */
export function Section({
  id,
  numeral,
  dark = false,
  ornament = false,
  children,
}: {
  id: string;
  numeral: string;
  dark?: boolean;
  ornament?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={dark ? "plate" : ""}>
      <div className="mx-auto max-w-5xl px-6 py-24 sm:px-10 lg:pl-40">
        {ornament ? (
          <div className="flex items-center gap-4">
            <Rule className="flex-1" />
            <Fleuron className="text-[var(--accent)]" />
            <Rule className="flex-1" />
          </div>
        ) : (
          <Rule />
        )}
        <p
          className="font-display mt-8 text-[var(--muted)]"
          style={{ fontSize: "var(--text-heading)" }}
        >
          {numeral}
        </p>
        {children}
      </div>
    </section>
  );
}
