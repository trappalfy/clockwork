"use client";

import { useSyncExternalStore } from "react";
import { Hero } from "./Hero";
import { MechanismScene } from "./MechanismScene";

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function reduceMotionQuery() {
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

/**
 * The three-way gate from the build plan: prefers-reduced-motion, no
 * or weak WebGL, or a low core count all fall back to plain Hero.
 *
 * useSyncExternalStore rather than a state-setting effect: WebGL
 * support and core count don't change at runtime, but reduced-motion
 * can (someone flips the OS setting with the tab still open), so this
 * needs to be a live subscription either way — and a subscription is
 * exactly what useSyncExternalStore is for. getServerSnapshot always
 * returns "plain", matching what the server renders, so there's no
 * hydration mismatch to paper over.
 */
function subscribe(callback: () => void) {
  const mq = reduceMotionQuery();
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): "rich" | "plain" {
  const reduceMotion = reduceMotionQuery().matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  return !reduceMotion && cores >= 4 && supportsWebGL() ? "rich" : "plain";
}

function getServerSnapshot(): "rich" | "plain" {
  return "plain";
}

export function HeroSequence() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return mode === "rich" ? <MechanismScene /> : <Hero />;
}
