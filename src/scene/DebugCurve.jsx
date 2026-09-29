import React, { useMemo } from "react";
import { Line } from "@react-three/drei";
import { degToRad, lerp, surfacePoint } from "../geometry/surfaceMath";

/**
 * Inspection curves:
 *  - mode = "r": Constant-radius spherical arc (b varies)
 *  - mode = "b": Constant-elevation radial line (r varies)
 *  - mode = "cyl": Cylindrical section cut (rho = const, r = rho/cos(b))
 */
export default function DebugCurve({
  mode = "r",
  params,
  value,
  samples = 180,
  color = "#ffffff",
  lineWidth = 2.4,
  rotationZ = 0,
}) {
  const points = useMemo(() => {
    const pts = [];

    if (mode === "cyl") {
      // Cylindrical section cut: rho = const
      const rho = value;
      const bMinRad = degToRad(params.bMin);
      const bMaxRad = degToRad(params.bMax);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const b = lerp(bMinRad, bMaxRad, t);
        const cosB = Math.cos(b);
        if (cosB < 1e-4) continue;
        const r = rho / cosB;
        if (r >= params.rMin && r <= params.rMax) {
          const p = surfacePoint(r, b, params.n);
          pts.push([p.x, p.y, p.z]);
        }
      }
    } else if (mode === "b") {
      // Constant-b radial ray
      const b = degToRad(value);
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const r = lerp(params.rMin, params.rMax, t);
        const p = surfacePoint(r, b, params.n);
        pts.push([p.x, p.y, p.z]);
      }
    } else {
      // Constant-r spherical arc
      const r = value;
      const bMinRad = degToRad(params.bMin);
      const bMaxRad = degToRad(params.bMax);
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const b = lerp(bMinRad, bMaxRad, t);
        const p = surfacePoint(r, b, params.n);
        pts.push([p.x, p.y, p.z]);
      }
    }

    return pts;
  }, [mode, params, value, samples]);

  if (points.length < 2) return null;

  return (
    <group rotation={[0, 0, rotationZ]}>
      <Line points={points} color={color} lineWidth={lineWidth} />
    </group>
  );
}