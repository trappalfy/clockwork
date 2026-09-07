"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Mechanism } from "./mechanism/Mechanism";
import { sampleKeyframes } from "./mechanism/keyframes";

/**
 * Reads the scroll progress ref every frame and drives the camera —
 * never React state. A state update per scroll tick would re-render
 * this whole tree at 60fps; a ref read inside useFrame doesn't touch
 * React at all.
 */
function CameraRig({ progressRef }: { progressRef: { current: number } }) {
  const { camera } = useThree();

  /* eslint-disable react-hooks/immutability --
   * The rule doesn't know react-three-fiber: mutating the three.js
   * object useThree() hands back, every frame, inside useFrame is the
   * library's normal camera-rig pattern (the same thing drei's own
   * CameraControls/OrbitControls do) — not state the React Compiler
   * owns or could safely memoize away. A ref/JSX rewrite here wouldn't
   * fix a real bug, just fight the framework. */
  useFrame(() => {
    const kf = sampleKeyframes(progressRef.current);
    camera.position.set(...kf.position);
    camera.lookAt(new THREE.Vector3(...kf.lookAt));
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = kf.fov;
      camera.updateProjectionMatrix();
    }
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}

export default function Scene({
  progressRef,
}: {
  progressRef: { current: number };
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 32, near: 0.1, far: 50 }}
      // The scene never has to look correct from the server — it's
      // always dynamically imported with ssr:false (see HeroSequence).
    >
      <CameraRig progressRef={progressRef} />
      <Mechanism progressRef={progressRef} />
    </Canvas>
  );
}
