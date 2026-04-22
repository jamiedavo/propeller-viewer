import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { meshConfig } from "../config/defaultParams";
import { buildBladeSurfaceData } from "../geometry/bladeMesh";
import { surfaceParamsFromUV } from "../geometry/surfaceMath";
import { usePropellerSpin } from "../hooks/usePropellerSpin";
import BladeSurfaceMesh from "./BladeSurfaceMesh";
import DebugCurve from "./DebugCurve";
import ProbePoint from "./ProbePoint";

/**
 * Two-blade rotating assembly.
 * Blade 2 is blade 1 rotated by Math.PI about z.
 */
export default function BladeAssembly({
  rMin,
  rMax,
  n,
  bMin,
  bMax,
  blade1Color,
  blade2Color,
  bladeOpacity,
  showProbe,
  showIsoR,
  showIsoB,
  probeU,
  probeV,
  probeVectorScale,
  rpm,
  isRunning,
}) {
  const assemblyRef = useRef(null);

  const surfaceParams = useMemo(() => {
    return {
      rMin,
      rMax,
      n,
      bMin,
      bMax,
      probeVectorScale,
    };
  }, [rMin, rMax, n, bMin, bMax, probeVectorScale]);

  const probeParams = useMemo(() => {
    return surfaceParamsFromUV(surfaceParams, probeU, probeV);
  }, [surfaceParams, probeU, probeV]);

  const sharedGeometry = useMemo(() => {
    const data = buildBladeSurfaceData({
      rMin,
      rMax,
      n,
      bMin,
      bMax,
      radialSegments: meshConfig.radialSegments,
      angularSegments: meshConfig.angularSegments,
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(data.positions, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(data.normals, 3)
    );
    geometry.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeBoundingSphere();

    return geometry;
  }, [rMin, rMax, n, bMin, bMax]);

  useEffect(() => {
    return () => {
      sharedGeometry.dispose();
    };
  }, [sharedGeometry]);

  usePropellerSpin(assemblyRef, rpm, isRunning);

  return (
    <group ref={assemblyRef}>
      <BladeSurfaceMesh
        geometry={sharedGeometry}
        color={blade1Color}
        opacity={bladeOpacity}
        rotationZ={0}
      />

      <BladeSurfaceMesh
        geometry={sharedGeometry}
        color={blade2Color}
        opacity={bladeOpacity}
        rotationZ={Math.PI}
      />

      {showIsoR && (
        <DebugCurve
          mode="r"
          params={surfaceParams}
          value={probeParams.r}
          color="#ffe082"
          rotationZ={0}
        />
      )}

      {showIsoB && (
        <DebugCurve
          mode="b"
          params={surfaceParams}
          value={probeParams.bDeg}
          color="#b8f2e6"
          rotationZ={0}
        />
      )}

      {showProbe && (
        <ProbePoint
          params={surfaceParams}
          u={probeU}
          v={probeV}
          rotationZ={0}
        />
      )}
    </group>
  );
}
