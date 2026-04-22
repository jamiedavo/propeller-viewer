import React, { useMemo } from "react";
import { Line } from "@react-three/drei";
import { degToRad, lerp, surfacePoint } from "../geometry/surfaceMath";

/**
 * General surface inspection curve.
 * mode = "r" gives a constant-r iso-curve as b varies.
 * mode = "b" gives a constant-b iso-line as r varies.
 */
export default function DebugCurve({
  mode = "r",
  params,
  value,
  samples = 240,
  color = "#ffffff",
  rotationZ = 0,
}) {
  const points = useMemo(() => {
    const pts = [];

    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;

      if (mode === "b") {
        const r = lerp(params.rMin, params.rMax, t);
        const b = degToRad(value);
        const p = surfacePoint(r, b, params.n);
        pts.push([p.x, p.y, p.z]);
      } else {
        const bDeg = lerp(params.bMin, params.bMax, t);
        const b = degToRad(bDeg);
        const p = surfacePoint(value, b, params.n);
        pts.push([p.x, p.y, p.z]);
      }
    }

    return pts;
  }, [mode, params, value, samples]);

  return (
    <group rotation={[0, 0, rotationZ]}>
      <Line points={points} color={color} lineWidth={2.2} />
    </group>
  );
}
