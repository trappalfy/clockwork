import * as THREE from "three";

export interface Keyframe {
  /** Camera position in scene units. */
  position: THREE.Vector3Tuple;
  /** Point the camera looks at. */
  lookAt: THREE.Vector3Tuple;
  fov: number;
  /** 0 idle → 1 full speed. Drives how fast the gear train turns. */
  drive: number;
}

/**
 * Three beats, not nine: this pinned region carries Rest → Wind →
 * Escapement (see the build plan). The remaining beats continue as
 * plain typographic sections below it, in normal scroll flow — the
 * mechanism doesn't run continuously behind the whole page.
 */
export const KEYFRAMES: Keyframe[] = [
  // 0 — Rest. Wide, static, the whole assembly readable at once.
  { position: [0, 0.3, 9], lookAt: [0, 0, 0], fov: 32, drive: 0 },
  // 1 — Wind. Push toward the barrel (screen-left), train starts turning.
  { position: [-2.4, 0.6, 5], lookAt: [-1.6, 0.2, 0], fov: 28, drive: 0.5 },
  // 2 — Escapement. In close on the anchor, full speed, ticking.
  { position: [2.2, 0.9, 3.4], lookAt: [1.6, 0.5, 0], fov: 24, drive: 1 },
];

function lerpV3(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, t: number): THREE.Vector3Tuple {
  return [
    THREE.MathUtils.lerp(a[0], b[0], t),
    THREE.MathUtils.lerp(a[1], b[1], t),
    THREE.MathUtils.lerp(a[2], b[2], t),
  ];
}

/** progress: 0..1 across the whole pinned region → interpolated keyframe. */
export function sampleKeyframes(progress: number): Keyframe {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const segments = KEYFRAMES.length - 1;
  const scaled = p * segments;
  const i = Math.min(Math.floor(scaled), segments - 1);
  const t = scaled - i;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  return {
    position: lerpV3(a.position, b.position, t),
    lookAt: lerpV3(a.lookAt, b.lookAt, t),
    fov: THREE.MathUtils.lerp(a.fov, b.fov, t),
    drive: THREE.MathUtils.lerp(a.drive, b.drive, t),
  };
}
