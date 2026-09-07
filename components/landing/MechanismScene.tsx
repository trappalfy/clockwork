"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useScrollProgress } from "./useScrollProgress";
import { HeroMasthead } from "./HeroMasthead";
import { HeroFacts } from "./HeroFacts";
import { Mark } from "@/components/ui/Mark";

// How long the mechanism runs alone, title-less, before the wordmark
// is allowed to appear. Matches HeroMasthead's own transition length.
const INTRO_DELAY_MS = 1800;
const INTRO_FADE_MS = 900;

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
  // Gates the scroll-driven fade below: false until the one-time entrance
  // finishes, so an eager scroll during the intro can't snap the title
  // to full opacity before it's had its moment alone with the machine.
  const introDoneRef = useRef(false);

  const progressRef = useScrollProgress(wrapperRef, (progress) => {
    if (mastheadRef.current && introDoneRef.current) {
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

  // The title's one-time entrance: hidden through the opening beat, then
  // fades in on a flat timer, independent of scroll. Once it fires,
  // introDoneRef hands control to the scroll-driven fade above — computed
  // from the live progress rather than assumed to be 0, in case the
  // visitor has already started scrolling during the delay.
  useEffect(() => {
    const timer = setTimeout(() => {
      introDoneRef.current = true;
      if (mastheadRef.current) {
        const opacity = 1 - Math.min(progressRef.current / 0.3, 1);
        mastheadRef.current.style.transition = `opacity ${INTRO_FADE_MS}ms ease`;
        mastheadRef.current.style.opacity = String(opacity);
      }
    }, INTRO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [progressRef]);

  return (
    <>
      <div ref={wrapperRef} className="relative" style={{ height: "320vh" }}>
        <div className="sticky top-0 h-screen overflow-hidden bg-[var(--paper)]">
          <Scene progressRef={progressRef} />

          <div
            ref={mastheadRef}
            className="pointer-events-none absolute inset-x-0 top-16 mx-auto w-full max-w-5xl px-6 sm:px-10"
            style={{ opacity: 0 }}
          >
            <HeroMasthead />
          </div>

          <div
            ref={engravingRef}
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--paper)]"
            style={{ opacity: 0 }}
          >
            <Mark className="w-40" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-6 sm:px-10">
        <HeroFacts />
      </div>
    </>
  );
}
