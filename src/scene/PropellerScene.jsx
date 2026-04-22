import React from "react";
import { OrbitControls } from "@react-three/drei";
import BladeAssembly from "./BladeAssembly";
import SceneAxes from "./SceneAxes";
import ShaftReference from "./ShaftReference";

/**
 * Clean scene with unlocked parametric domain and inspection overlays.
 */
export default function PropellerScene({ params }) {
  const {
    rMin,
    rMax,
    n,
    bMin,
    bMax,
    gridOpacity,
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
  } = params;

  const axisLength = Math.max(3.5, rMax + 1.25);
  const shaftLength = Math.max(5, rMax * 3);

  return (
    <>
      <color attach="background" args={["#0f1115"]} />

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 6, 4]} intensity={1.15} />
      <directionalLight position={[-4, -2, 3]} intensity={0.55} />
      <directionalLight position={[0, 0, 6]} intensity={0.35} />

      <gridHelper
        args={[10, 10, "#444444", "#222222"]}
        material-transparent
        material-opacity={gridOpacity}
        material-depthWrite={false}
      />

      <SceneAxes length={axisLength} />
      <ShaftReference length={shaftLength} />

      <BladeAssembly
        rMin={rMin}
        rMax={rMax}
        n={n}
        bMin={bMin}
        bMax={bMax}
        blade1Color={blade1Color}
        blade2Color={blade2Color}
        showProbe={showProbe}
        showIsoR={showIsoR}
        showIsoB={showIsoB}
        probeU={probeU}
        probeV={probeV}
        probeVectorScale={probeVectorScale}
        rpm={rpm}
        isRunning={isRunning}
      />

      <OrbitControls enableDamping dampingFactor={0.08} />
    </>
  );
}