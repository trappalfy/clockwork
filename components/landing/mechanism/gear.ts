import * as THREE from "three";

/**
 * A real involute-ish gear profile, not a placeholder cylinder: outer
 * teeth cut by alternating radius points around a circle, with a bore
 * hole through the middle. Built once per distinct size and reused via
 * InstancedMesh — see Mechanism.tsx.
 */
export function buildGearGeometry({
  teeth,
  outerRadius,
  rootRadius,
  boreRadius,
  depth,
}: {
  teeth: number;
  outerRadius: number;
  rootRadius: number;
  boreRadius: number;
  depth: number;
}) {
  const shape = new THREE.Shape();
  const steps = teeth * 4; // four points per tooth: root, flank, tip, flank

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const toothPhase = (i % 4) / 4;
    const r =
      toothPhase < 0.5
        ? THREE.MathUtils.lerp(rootRadius, outerRadius, toothPhase * 2)
        : THREE.MathUtils.lerp(outerRadius, rootRadius, (toothPhase - 0.5) * 2);
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.15,
    bevelSize: depth * 0.1,
    bevelSegments: 1,
    // The teeth are straight lineTo segments, so this only tessellates
    // the bore hole's arc — it needs to be high enough to read as a
    // circle, not the tooth profile (which curveSegments doesn't touch).
    curveSegments: 24,
  });
  geometry.center();
  return geometry;
}
