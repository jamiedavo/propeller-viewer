import React from "react";
import { Line, Text } from "@react-three/drei";

/**
 * Simple visible xyz axes with labels.
 * X = red, Y = green, Z = blue
 */
export default function SceneAxes({ length = 3.5 }) {
  return (
    <group>
      <Line points={[[0, 0, 0], [length, 0, 0]]} color="red" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, length, 0]]} color="green" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, length]]} color="blue" lineWidth={2} />

      <Text position={[length + 0.15, 0, 0]} fontSize={0.18} color="red">
        X
      </Text>
      <Text position={[0, length + 0.15, 0]} fontSize={0.18} color="green">
        Y
      </Text>
      <Text position={[0, 0, length + 0.15]} fontSize={0.18} color="blue">
        Z
      </Text>
    </group>
  );
}
