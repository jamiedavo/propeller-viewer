import React from "react";
import { Line, Text } from "@react-three/drei";

// Axis letters load a font over the network. If that fails (offline, blocked),
// skip the letters instead of taking the whole 3D scene down with them.
class LabelBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Simple visible xyz axes with labels.
 * X = red, Y = green, Z = blue
 */
export default function SceneAxes({ length = 3.5 }) {
  const labelSize = Math.max(0.03, length * 0.12);
  const off = labelSize * 0.9;
  return (
    <group>
      <Line points={[[0, 0, 0], [length, 0, 0]]} color="red" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, length, 0]]} color="green" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, length]]} color="blue" lineWidth={2} />

      <LabelBoundary>
        <React.Suspense fallback={null}>
          <Text position={[length + off, 0, 0]} fontSize={labelSize} color="red">X</Text>
          <Text position={[0, length + off, 0]} fontSize={labelSize} color="green">Y</Text>
          <Text position={[0, 0, length + off]} fontSize={labelSize} color="blue">Z</Text>
        </React.Suspense>
      </LabelBoundary>
    </group>
  );
}
