import { HeroSequence } from "@/components/landing/HeroSequence";
import { Nav } from "@/components/landing/Nav";
import { Section } from "@/components/landing/Section";
import {
  Enter,
  Escapement,
  Gears,
  Press,
  Tape,
  Wind,
} from "@/components/landing/sections";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)] text-[var(--fg)]">
      <Nav />
      <HeroSequence />

      <Section id="wind" numeral="I" dark image="/plates/wind.jpg">
        <Wind />
      </Section>

      <Section id="escapement" numeral="II">
        <Escapement />
      </Section>

      <Section id="gears" numeral="III" dark image="/plates/gears.jpg">
        <Gears />
      </Section>

      <Section id="press" numeral="IV">
        <Press />
      </Section>

      <Section id="tape" numeral="V" dark image="/plates/tape.jpg">
        <Tape />
      </Section>

      <Section id="enter" numeral="VI" ornament>
        <Enter />
      </Section>
    </div>
  );
}
