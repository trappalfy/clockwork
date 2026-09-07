"use client";

import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let registered = false;

/**
 * Tracks scroll progress (0..1) through `triggerRef`'s element into a
 * ref — never React state, so 60fps scroll doesn't mean 60fps
 * re-renders. Pinning itself is plain CSS `position: sticky` on the
 * caller's inner element, not ScrollTrigger's own pin: mixing Lenis's
 * virtual scroll with GSAP's pin-spacer DOM surgery is a well-known
 * source of drift; sticky plus a scrub-only ScrollTrigger avoids it.
 *
 * `onUpdate` is for imperative DOM writes outside React (fading the
 * masthead text) — same reasoning as the ref itself.
 */
export function useScrollProgress(
  triggerRef: RefObject<HTMLElement | null>,
  onUpdate?: (progress: number) => void,
) {
  const progressRef = useRef(0);
  const onUpdateRef = useRef(onUpdate);
  // Keeping the ref current belongs in an effect, not the render body
  // — render can run speculatively/be discarded, so a ref write there
  // isn't safe to rely on. No dependency array: this just needs to run
  // after every render, same as the old body-level assignment did.
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;

    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        progressRef.current = self.progress;
        onUpdateRef.current?.(self.progress);
      },
    });

    return () => {
      trigger.kill();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [triggerRef]);

  return progressRef;
}
