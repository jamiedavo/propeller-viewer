import React, { useEffect, useMemo } from "react";
import * as THREE from "three";

function deriveTones(colorHex) {
  const base = new THREE.Color(colorHex);
  return {
    front: base.clone().lerp(new THREE.Color("#ffffff"), 0.08),
    back: base.clone().multiplyScalar(0.65),
    edge: base.clone().multiplyScalar(0.4),
  };
}

export default function BladeSurfaceMesh({
  geometry,
  color = "#3a88c8",
  rotationZ = 0,
  showEdges = true,
  colorMode = "dualtone",
}) {
  const boundaryEdges = useMemo(() => {
    return new THREE.EdgesGeometry(geometry, 30);
  }, [geometry]);

  const tones = useMemo(() => deriveTones(color), [color]);

  useEffect(() => {
    return () => boundaryEdges.dispose();
  }, [boundaryEdges]);

  if (colorMode === "wireframe") {
    return (
      <group rotation={[0, 0, rotationZ]}>
        <mesh geometry={geometry}>
          <meshBasicMaterial color={tones.front} wireframe />
        </mesh>
      </group>
    );
  }

  const isHeatmap = colorMode === "pitch" || colorMode === "radius" || colorMode === "thrust";

  return (
    <group rotation={[0, 0, rotationZ]}>
      {isHeatmap ? (
        <mesh geometry={geometry}>
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      ) : (
        <>
          {/* Back / Pressure Side */}
          <mesh geometry={geometry} renderOrder={1}>
            <meshStandardMaterial
              color={tones.back}
              side={THREE.BackSide}
              roughness={0.6}
              metalness={0.12}
            />
          </mesh>

          {/* Front / Suction Side */}
          <mesh geometry={geometry} renderOrder={2}>
            <meshStandardMaterial
              color={tones.front}
              side={THREE.FrontSide}
              roughness={0.45}
              metalness={0.18}
            />
          </mesh>
        </>
      )}

      {/* Sharp boundary edge lines */}
      {showEdges && (
        <lineSegments geometry={boundaryEdges} renderOrder={3}>
          <lineBasicMaterial color={tones.edge} transparent opacity={0.9} />
        </lineSegments>
      )}
    </group>
  );
}