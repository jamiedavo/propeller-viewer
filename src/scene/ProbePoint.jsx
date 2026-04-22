import React, { useMemo } from "react";
import { Line } from "@react-three/drei";
import {
  add,
  scale,
  surfaceFrameFromUV,
} from "../geometry/surfaceMath";

function pointToArray(point) {
  return [point.x, point.y, point.z];
}

/**
 * Probe a single location on blade 1.
 * Renders the point plus local tangent and normal directions.
 */
export default function ProbePoint({
  params,
  u,
  v,
  rotationZ = 0,
  color = "#ffe082",
}) {
  const frame = useMemo(() => {
    return surfaceFrameFromUV(params, u, v);
  }, [params, u, v]);

  const tangentRLine = useMemo(() => {
    return [
      pointToArray(frame.point),
      pointToArray(add(frame.point, scale(frame.tangentRUnit, params.probeVectorScale))),
    ];
  }, [frame, params.probeVectorScale]);

  const tangentBLine = useMemo(() => {
    return [
      pointToArray(frame.point),
      pointToArray(add(frame.point, scale(frame.tangentBUnit, params.probeVectorScale))),
    ];
  }, [frame, params.probeVectorScale]);

  const normalLine = useMemo(() => {
    return [
      pointToArray(frame.point),
      pointToArray(add(frame.point, scale(frame.normal, params.probeVectorScale))),
    ];
  }, [frame, params.probeVectorScale]);

  return (
    <group rotation={[0, 0, rotationZ]}>
      <mesh position={pointToArray(frame.point)} renderOrder={4}>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
      </mesh>

      <Line points={tangentRLine} color="#64d2ff" lineWidth={2} />
      <Line points={tangentBLine} color="#ff8cc6" lineWidth={2} />
      <Line points={normalLine} color="#fff3b0" lineWidth={2} />
    </group>
  );
}
