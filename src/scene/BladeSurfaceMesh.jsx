import React, { useEffect, useMemo } from "react";
import * as THREE from "three";

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

  useEffect(() => {
    return () => {
      boundaryEdges.dispose();
    };
  }, [boundaryEdges]);

  return (
    <group rotation={[0, 0, rotationZ]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.42}
          metalness={0.04}
        />
      </mesh>

      <lineSegments geometry={boundaryEdges}>
        <lineBasicMaterial
          color={color}
          depthTest
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}