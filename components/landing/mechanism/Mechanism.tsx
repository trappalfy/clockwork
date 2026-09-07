"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildGearGeometry } from "./gear";

const BRASS = "#B08243";
const BRASS_LIGHT = "#D8B478";

interface GearSpec {
  position: THREE.Vector3Tuple;
  scale: number;
  /** Relative rotation rate — sign is direction, larger gears turn slower. */
  speed: number;
  light?: boolean;
}

const GEAR_SPECS: GearSpec[] = [
  { position: [-1.6, 0.2, 0], scale: 1.1, speed: 0.5 },
  { position: [0, 0, 0], scale: 0.75, speed: -0.85, light: true },
  { position: [1.05, 0.35, 0.12], scale: 0.55, speed: 1.3 },
  { position: [1.7, 0.55, 0.22], scale: 0.5, speed: -1.6 },
  { position: [0.5, -0.6, -0.15], scale: 0.4, speed: -1.9, light: true },
];

/**
 * No environment map and no MeshPhysicalMaterial clearcoat — the plan
 * called for a hand-rolled fresnel shader, but a from-scratch GLSL
 * material can't be art-directed without a visual iteration loop this
 * build doesn't have. Two lights (warm key, cool rim) on plain metal
 * MeshStandardMaterial reads as brass without either the risk of a
 * broken custom shader or the weight of a texture/HDRI asset — same
 * "no textures" constraint, safer path to it.
 */
export function Mechanism({
  progressRef,
}: {
  progressRef: { current: number };
}) {
  const gearGeo = useMemo(
    () =>
      buildGearGeometry({
        teeth: 14,
        outerRadius: 1,
        rootRadius: 0.82,
        boreRadius: 0.2,
        depth: 0.16,
      }),
    [],
  );

  const gearMeshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, delta) => {
    const speedMul = THREE.MathUtils.clamp(progressRef.current, 0, 1);
    gearMeshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.rotation.z += delta * GEAR_SPECS[i].speed * (0.12 + speedMul * 0.9);
    });
  });

  return (
    <group>
      {GEAR_SPECS.map((g, i) => (
        <mesh
          key={i}
          ref={(el) => {
            gearMeshRefs.current[i] = el;
          }}
          geometry={gearGeo}
          position={g.position}
          scale={g.scale}
        >
          <meshStandardMaterial
            color={g.light ? BRASS_LIGHT : BRASS}
            metalness={1}
            roughness={0.35}
          />
        </mesh>
      ))}

      <hemisphereLight args={["#3a3226", "#0a0806", 0.6]} />
      <directionalLight position={[3, 4, 5]} intensity={2.6} color="#ffe4b8" />
      <directionalLight position={[-4, -1, -3]} intensity={0.9} color="#8fb9c9" />
    </group>
  );
}
