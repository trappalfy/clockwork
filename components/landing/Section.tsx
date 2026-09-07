import type { ReactNode } from "react";
import Image from "next/image";
import { Rule } from "@/components/ui/Rule";
import { Fleuron } from "@/components/ui/Fleuron";

/**
 * One stage of the mechanism. A plain Rule opens every section — it
 * marks a real boundary, nothing more. The Fleuron is reserved for a
 * single section (ornament=true): the one threshold on the page that
 * actually matters, where the story stops explaining and the page asks
 * for action. Used everywhere, it would stop meaning anything.
 *
 * `image` is a plate-only option: a photograph standing in for the flat
 * --plate ground. The flat colour still paints first (it's the section's
 * own background, set by the .plate class) — the photo and scrim sit
 * above it as layers, so a slow or failed image load never leaves the
 * section unreadable. The scrim is mixed near-opaque with --plate on
 * purpose: it's what keeps the --paper-on-plate contrast ratios measured
 * in tokens.css valid for the text sitting on top, rather than at the
 * mercy of whatever tones happen to be in the photo underneath.
 */
export function Section({
  id,
  numeral,
  dark = false,
  ornament = false,
  image,
  children,
}: {
  id: string;
  numeral: string;
  dark?: boolean;
  ornament?: boolean;
  image?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`relative overflow-hidden ${dark ? "plate" : ""}`}>
      {dark && image ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ filter: "saturate(0.7) sepia(0.15) contrast(1.05) brightness(0.85)" }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "var(--plate)", opacity: 0.78 }}
          />
        </>
      ) : null}
      <div className="relative mx-auto max-w-5xl px-6 py-24 sm:px-10">
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
