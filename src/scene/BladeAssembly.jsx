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
 * Rotating blade assembly.
 * Each blade is an identical rendered instance of the original parametric surface,
 * evenly rotated around the z-axis.
 */
export default function BladeAssembly({
  rMin,
  rMax,
  n,
  bMin,
  bMax,
  bladeCount,
  blade1Color,
  blade2Color,
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

  const bladeInstances = useMemo(() => {
    const safeBladeCount = Math.max(2, Math.min(6, Math.round(Number(bladeCount) || 2)));
    const angleStep = (Math.PI * 2) / safeBladeCount;

    return Array.from({ length: safeBladeCount }, (_, index) => ({
      index,
      rotationZ: index * angleStep,
      color: index === 0 ? blade1Color : blade2Color,
    }));
  }, [bladeCount, blade1Color, blade2Color]);

  useEffect(() => {
    return () => {
      sharedGeometry.dispose();
    };
  }, [sharedGeometry]);

  usePropellerSpin(assemblyRef, rpm, isRunning);

  return (
    <group ref={assemblyRef}>
      {bladeInstances.map((blade) => (
        <BladeSurfaceMesh
          key={`blade-${blade.index}`}
          geometry={sharedGeometry}
          color={blade.color}
          rotationZ={blade.rotationZ}
        />
      ))}

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
