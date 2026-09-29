import React, { useMemo } from "react";
import { Line } from "@react-three/drei";
import { add, scale, surfaceFrameFromUV } from "../geometry/surfaceMath";

function toArray(pt) {
  return [pt.x, pt.y, pt.z];
}

/**
 * Interactive surface probe displaying exact local coordinates and tangent-normal triad.
 */
export default function ProbePoint({ params, u, v, rotationZ = 0 }) {
  const frame = useMemo(() => {
    return surfaceFrameFromUV(params, u, v);
  }, [params, u, v]);

  const triad = useMemo(() => {
    const s = params.probeVectorScale || 0.35;
    return {
      pt: toArray(frame.point),
      tanR: [toArray(frame.point), toArray(add(frame.point, scale(frame.tangentRUnit, s)))],
      tanB: [toArray(frame.point), toArray(add(frame.point, scale(frame.tangentBUnit, s)))],
      norm: [toArray(frame.point), toArray(add(frame.point, scale(frame.normal, s)))],
    };
  }, [frame, params.probeVectorScale]);

  return (
    <group rotation={[0, 0, rotationZ]}>
      <mesh position={triad.pt} renderOrder={10}>
        <sphereGeometry args={[0.045, 18, 18]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffb300" emissiveIntensity={0.6} />
      </mesh>

      {/* Tangent along r (Radial) - Cyan */}
      <Line points={triad.tanR} color="#00e5ff" lineWidth={2.5} />
      {/* Tangent along b (Elevation / Chord) - Pink */}
      <Line points={triad.tanB} color="#ff4081" lineWidth={2.5} />
      {/* Analytical Unit Normal - Bright Yellow */}
      <Line points={triad.norm} color="#ffea00" lineWidth={3.2} />
    </group>
  );
}