import { HeroMasthead } from "./HeroMasthead";
import { HeroFacts } from "./HeroFacts";
import { Mark } from "@/components/ui/Mark";

/**
 * The plain path: no WebGL, no scroll-jacking. Used directly when
 * reduced motion is requested or WebGL isn't available, and as the
 * server-rendered default before HeroSequence decides which path to
 * show — see HeroSequence.tsx.
 */
export function Hero() {
  return (
    <header className="mx-auto w-full max-w-5xl px-6 pt-16 sm:px-10">
      <HeroMasthead />
      <HeroFacts />
      <Mark className="mx-auto my-16 w-40 text-[var(--ink-soft)]" />
    </header>
  );
}
