import { Rule } from "@/components/ui/Rule";

/** Three evergreen facts, not a dateline — see the build plan's note on why. */
export function HeroFacts() {
  return (
    <>
      <Rule className="mt-10" />
      <div className="font-mono flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 text-[var(--text-caption)] tracking-wide">
        <span>ROBINHOOD CHAIN</span>
        <span>NO CUSTODY, NO ACCOUNTS</span>
        <span>~90 ASSETS</span>
      </div>
      <Rule />
    </>
  );
}
