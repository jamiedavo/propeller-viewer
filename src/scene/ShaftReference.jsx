import React from "react";

/**
 * Technical Shaft and Central Hub Assembly.
 * hubRadius is dynamically sized to prevent blade root penetration.
 */
export default function ShaftReference({
  length = 6.0,
  shaftRadius = 0.025,
  hubRadius = 0.12,
  hubLength = 0.4,
  color = "#a5b4c8",
}) {
  const spinnerHeight = hubRadius * 1.5;

  return (
    <group>
      {/* Central Shaft (aligned along z-axis) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, length, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.65} />
      </mesh>

      {/* Hub mounting cylinder */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[hubRadius, hubRadius, hubLength, 32]} />
        <meshStandardMaterial color="#1b2333" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Aerodynamic spinner nose cone along +Z */}
      <mesh
        position={[0, 0, hubLength * 0.5 + spinnerHeight * 0.5]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <coneGeometry args={[hubRadius, spinnerHeight, 32]} />
        <meshStandardMaterial color="#2a354a" roughness={0.25} metalness={0.75} />
      </mesh>
    </group>
  );
}