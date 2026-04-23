import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import BladeAssembly from "./BladeAssembly";
import SceneAxes from "./SceneAxes";
import ShaftReference from "./ShaftReference";

function getViewMetrics(rMax, bMin, bMax) {
  const bMinRad = THREE.MathUtils.degToRad(bMin);
  const bMaxRad = THREE.MathUtils.degToRad(bMax);
  const tipRadius = Math.max(0.25, rMax);
  const maxHeight =
    tipRadius * Math.max(Math.abs(Math.sin(bMinRad)), Math.abs(Math.sin(bMaxRad)));
  const framingRadius = Math.max(1.9, tipRadius + maxHeight * 0.75);

  return {
    lateralDistance: Math.max(5.6, framingRadius * 2.45),
    axialDistance: Math.max(4.8, framingRadius * 2.1),
    shaftDistance: Math.max(4.1, framingRadius * 1.7),
  };
}

function getViewPreset(viewKey, rMax, bMin, bMax) {
  const { lateralDistance, axialDistance, shaftDistance } = getViewMetrics(
    rMax,
    bMin,
    bMax
  );

  switch (viewKey) {
    case "front":
      return {
        position: new THREE.Vector3(0, lateralDistance, 0.3),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };

    case "back":
      return {
        position: new THREE.Vector3(0, -lateralDistance, 0.3),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };

    case "top":
      return {
        position: new THREE.Vector3(0, 0, axialDistance),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 1, 0),
      };

    case "bottom":
      return {
        position: new THREE.Vector3(0, 0, -axialDistance),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 1, 0),
      };

    case "side":
      return {
        position: new THREE.Vector3(lateralDistance, 0, 0.25),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };

    case "isometric":
      return {
        position: new THREE.Vector3(
          lateralDistance * 0.94,
          lateralDistance * 0.78,
          lateralDistance * 0.58
        ),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };

    case "shaft":
      return {
        position: new THREE.Vector3(0.45, 0, shaftDistance),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 1, 0),
      };

    case "reset":
    default:
      return {
        position: new THREE.Vector3(
          lateralDistance * 0.94,
          lateralDistance * 0.78,
          lateralDistance * 0.58
        ),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };
  }
}

function CameraSnapController({ controlsRef, viewRequest, rMax, bMin, bMax }) {
  const { camera } = useThree();

  const hasInitializedRef = useRef(false);
  const isAnimatingRef = useRef(false);

  const desiredPositionRef = useRef(new THREE.Vector3());
  const desiredTargetRef = useRef(new THREE.Vector3());
  const desiredUpRef = useRef(new THREE.Vector3(0, 0, 1));

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls || hasInitializedRef.current) {
      return;
    }

    const initialPreset = getViewPreset("reset", rMax, bMin, bMax);

    camera.position.copy(initialPreset.position);
    camera.up.copy(initialPreset.up).normalize();
    controls.target.copy(initialPreset.target);
    camera.lookAt(initialPreset.target);
    controls.update();

    hasInitializedRef.current = true;
  }, [camera, controlsRef, rMax, bMin, bMax]);

  useEffect(() => {
    if (!viewRequest || viewRequest.nonce === 0) {
      return;
    }

    const preset = getViewPreset(viewRequest.key, rMax, bMin, bMax);

    desiredPositionRef.current.copy(preset.position);
    desiredTargetRef.current.copy(preset.target);
    desiredUpRef.current.copy(preset.up).normalize();
    isAnimatingRef.current = true;
  }, [viewRequest, rMax, bMin, bMax]);

  useFrame((_, delta) => {
    if (!isAnimatingRef.current) {
      return;
    }

    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    const blend = 1 - Math.exp(-delta * 8);

    camera.position.lerp(desiredPositionRef.current, blend);
    controls.target.lerp(desiredTargetRef.current, blend);
    camera.up.lerp(desiredUpRef.current, blend).normalize();

    camera.lookAt(controls.target);
    controls.update();

    const positionSettled =
      camera.position.distanceToSquared(desiredPositionRef.current) < 1e-4;
    const targetSettled =
      controls.target.distanceToSquared(desiredTargetRef.current) < 1e-4;
    const upSettled = camera.up.distanceToSquared(desiredUpRef.current) < 1e-4;

    if (positionSettled && targetSettled && upSettled) {
      camera.position.copy(desiredPositionRef.current);
      controls.target.copy(desiredTargetRef.current);
      camera.up.copy(desiredUpRef.current).normalize();
      camera.lookAt(controls.target);
      controls.update();

      isAnimatingRef.current = false;
    }
  });

  return null;
}

/**
 * Clean scene with unlocked parametric domain and inspection overlays.
 */
export default function PropellerScene({ params, viewRequest }) {
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

  const axisLength = Math.max(4.2, rMax + 1.35);
  const shaftLength = Math.max(6.2, rMax * 3.4);
  const gridSize = Math.max(10, rMax * 5.5);
  const gridDivisions = Math.max(10, Math.round(gridSize));
  const controlsRef = useRef(null);

  return (
    <>
      <color attach="background" args={["#0e1118"]} />

      <ambientLight intensity={0.48} />
      <hemisphereLight
        args={["#b8d6ff", "#05070b", 0.72]}
      />
      <directionalLight position={[5, 6, 5]} intensity={1.05} />
      <directionalLight position={[-5, 2, 3.5]} intensity={0.45} />
      <directionalLight position={[0, -6, 2.75]} intensity={0.28} />

      <gridHelper
        args={[gridSize, gridDivisions, "#3e4656", "#1b2230"]}
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

      <CameraSnapController
        controlsRef={controlsRef}
        viewRequest={viewRequest}
        rMax={rMax}
        bMin={bMin}
        bMax={bMax}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={Math.max(2.2, rMax * 0.95)}
        maxDistance={Math.max(16, rMax * 8)}
        target={[0, 0, 0]}
      />
    </>
  );
}