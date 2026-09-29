import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { meshConfig } from "../config/defaultParams";
import { buildBladeSurfaceData } from "../geometry/bladeMesh";
import { surfaceParamsFromUV } from "../geometry/surfaceMath";
import { usePropellerSpin } from "../hooks/usePropellerSpin";
import BladeSurfaceMesh from "./BladeSurfaceMesh";
import DebugCurve from "./DebugCurve";
import ProbePoint from "./ProbePoint";

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
  showCylCut,
  showEdges,
  solidBlade,
  bladeThickness,
  colorMode,
  probeU,
  probeV,
  probeVectorScale,
  rpm,
  isRunning,
  onGeometryReady,
}) {
  const assemblyRef = useRef(null);

  const surfaceParams = useMemo(
    () => ({ rMin, rMax, n, bMin, bMax, probeVectorScale }),
    [rMin, rMax, n, bMin, bMax, probeVectorScale]
  );

  const probeCoords = useMemo(
    () => surfaceParamsFromUV(surfaceParams, probeU, probeV),
    [surfaceParams, probeU, probeV]
  );

  const probeCylRadius = useMemo(() => {
    return probeCoords.r * Math.cos((probeCoords.bDeg * Math.PI) / 180);
  }, [probeCoords]);

  const sharedGeometry = useMemo(() => {
    const data = buildBladeSurfaceData({
      rMin,
      rMax,
      n,
      bMin,
      bMax,
      radialSegments: meshConfig.radialSegments,
      angularSegments: meshConfig.angularSegments,
      solidBlade,
      bladeThickness,
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geo.computeBoundingSphere();

    if (onGeometryReady) {
      onGeometryReady(geo);
    }

    return geo;
  }, [rMin, rMax, n, bMin, bMax, solidBlade, bladeThickness, onGeometryReady]);

  const blades = useMemo(() => {
    const count = Math.max(1, Math.min(8, Math.round(bladeCount)));
    const step = (Math.PI * 2) / count;

    return Array.from({ length: count }, (_, i) => ({
      index: i,
      rotationZ: i * step,
      color: i === 0 ? blade1Color : blade2Color,
    }));
  }, [bladeCount, blade1Color, blade2Color]);

  useEffect(() => {
    return () => sharedGeometry.dispose();
  }, [sharedGeometry]);

  usePropellerSpin(assemblyRef, rpm, isRunning);

  return (
    <group ref={assemblyRef}>
      {blades.map((b) => (
        <BladeSurfaceMesh
          key={`blade-${b.index}`}
          geometry={sharedGeometry}
          color={b.color}
          rotationZ={b.rotationZ}
          showEdges={showEdges}
          colorMode={colorMode}
        />
      ))}

      {/* Constant-Radius Spherical Arc */}
      {showIsoR && (
        <DebugCurve
          mode="r"
          params={surfaceParams}
          value={probeCoords.r}
          color="#ffe082"
          lineWidth={2.8}
        />
      )}

      {/* Constant-Elevation Radial Ray */}
      {showIsoB && (
        <DebugCurve
          mode="b"
          params={surfaceParams}
          value={probeCoords.bDeg}
          color="#80deea"
          lineWidth={2.8}
        />
      )}

      {/* Cylindrical Section Cut (rho = const) */}
      {showCylCut && (
        <DebugCurve
          mode="cyl"
          params={surfaceParams}
          value={probeCylRadius}
          color="#ff80ab"
          lineWidth={3.0}
        />
      )}

      {/* Leading Edge Highlight (Green) */}
      {showEdges && (
        <DebugCurve
          mode="b"
          params={surfaceParams}
          value={bMin}
          color="#00e676"
          lineWidth={2.2}
        />
      )}

      {/* Trailing Edge Highlight (Coral Red) */}
      {showEdges && (
        <DebugCurve
          mode="b"
          params={surfaceParams}
          value={bMax}
          color="#ff5252"
          lineWidth={2.2}
        />
      )}

      {/* Interactive Surface Probe */}
      {showProbe && (
        <ProbePoint params={surfaceParams} u={probeU} v={probeV} />
      )}
    </group>
  );
}