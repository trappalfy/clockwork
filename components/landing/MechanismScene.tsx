"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { useScrollProgress } from "./useScrollProgress";
import { HeroMasthead } from "./HeroMasthead";
import { HeroFacts } from "./HeroFacts";
import { EscapementSketch } from "./EscapementSketch";

// three/@react-three never touch the server, and never touch /app —
// see the eslint zone rule and FRONTEND.md's bundle-isolation note.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

/**
 * The rich path: a 320vh pinned region carrying Rest → Wind →
 * Escapement (see mechanism/keyframes.ts). Everything after it —
 * Gears, Press, Tape, Enter — continues in plain scroll flow exactly
 * as HeroSequence's fallback path leaves it; the mechanism doesn't run
 * behind the whole page, just this opening stretch.
 */
export function MechanismScene() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mastheadRef = useRef<HTMLDivElement>(null);
  const engravingRef = useRef<HTMLDivElement>(null);

  const progressRef = useScrollProgress(wrapperRef, (progress) => {
    if (mastheadRef.current) {
      // Visible at rest, gone by a third of the way into the wind beat.
      mastheadRef.current.style.opacity = String(
        1 - Math.min(progress / 0.3, 1),
      );
    }
    if (engravingRef.current) {
      // The freeze: the live scene crossfades to its own still image
      // over the last stretch, so the handoff to plain paper at the
      // bottom of this block is a cut between two engravings, not a
      // WebGL canvas snapping to a blank page.
      engravingRef.current.style.opacity = String(
        Math.max((progress - 0.85) / 0.15, 0),
      );
    }
  });

  return (
    <>
      <div ref={wrapperRef} className="relative" style={{ height: "320vh" }}>
        <div className="sticky top-0 h-screen overflow-hidden bg-[var(--paper)]">
          <Scene progressRef={progressRef} />

          <div
            ref={mastheadRef}
            className="pointer-events-none absolute inset-x-0 top-16 mx-auto w-full max-w-5xl px-6 sm:px-10 lg:pl-40"
          >
            <HeroMasthead />
          </div>

          <div
            ref={engravingRef}
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--paper)]"
            style={{ opacity: 0 }}
          >
            <EscapementSketch className="w-full max-w-md text-[var(--ink-soft)]" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-6 sm:px-10 lg:pl-40">
        <HeroFacts />
      </div>
    </>
  );
}
