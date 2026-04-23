import React, { useEffect, useMemo } from "react";
import * as THREE from "three";

function deriveReadableTones(color) {
  const base = new THREE.Color(color);
  const front = base.clone().lerp(new THREE.Color("#ffffff"), 0.08);
  const back = base.clone().multiplyScalar(0.68);
  const edge = base.clone().multiplyScalar(0.48);

  return { front, back, edge };
}

/**
 * Pure rendering component for one blade mesh.
 * Geometry is passed in from the assembly so both blades
 * can share the exact same BufferGeometry instance.
 *
 * Rendering approach:
 * - fully opaque blade surface
 * - normal depth behavior
 * - subtle boundary edges for paused-state readability
 */
export default function BladeSurfaceMesh({
  geometry,
  color = "#7ec8e3",
  rotationZ = 0,
}) {
  const boundaryEdges = useMemo(() => {
    return new THREE.EdgesGeometry(geometry, 35);
  }, [geometry]);

  const tones = useMemo(() => deriveReadableTones(color), [color]);

  useEffect(() => {
    return () => {
      boundaryEdges.dispose();
    };
  }, [boundaryEdges]);

  return (
    <group rotation={[0, 0, rotationZ]}>
      <mesh geometry={geometry} renderOrder={1}>
        <meshStandardMaterial
          color={tones.back}
          side={THREE.BackSide}
          roughness={0.68}
          metalness={0.02}
        />
      </mesh>

      <mesh geometry={geometry} renderOrder={2}>
        <meshStandardMaterial
          color={tones.front}
          side={THREE.FrontSide}
          roughness={0.54}
          metalness={0.03}
        />
      </mesh>

      <lineSegments geometry={boundaryEdges} renderOrder={3}>
        <lineBasicMaterial
          color={tones.edge}
          depthTest
          toneMapped={false}
          transparent
          opacity={0.95}
        />
      </lineSegments>
    </group>
  );
}