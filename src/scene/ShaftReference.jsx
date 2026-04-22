import React from "react";

/**
 * Simple visible shaft / axis reference through the prop center.
 * This is not hub geometry.
 */
export default function ShaftReference({
  length = 5,
  radius = 0.03,
  color = "#d7dde8",
}) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, length, 20]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.9}
          roughness={0.55}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
