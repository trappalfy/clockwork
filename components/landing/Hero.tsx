import { HeroMasthead } from "./HeroMasthead";
import { HeroFacts } from "./HeroFacts";
import { EscapementSketch } from "./EscapementSketch";

/**
 * The plain path: no WebGL, no scroll-jacking. Used directly when
 * reduced motion is requested or WebGL isn't available, and as the
 * server-rendered default before HeroSequence decides which path to
 * show — see HeroSequence.tsx.
 */
export function Hero() {
  return (
    <header className="mx-auto w-full max-w-5xl px-6 pt-16 sm:px-10 lg:pl-40">
      <HeroMasthead />
      <HeroFacts />
      <EscapementSketch className="mx-auto my-16 w-full max-w-md text-[var(--ink-soft)]" />
    </header>
  );
}
