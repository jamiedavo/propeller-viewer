import React from "react";

/**
 * Plain straight shaft along the z-axis (the propeller's rotation axis).
 * Blade tip edges lie on this axis, so a straight rod joins them.
 */
export default function ShaftReference({ length = 2.0, radius = 0.03, color = "#a5b4c8" }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius, length, 48]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.65} />
    </mesh>
  );
}
