import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import BladeAssembly from "./BladeAssembly";
import SceneAxes from "./SceneAxes";
import ShaftReference from "./ShaftReference";

function getViewPreset(viewKey, rMax) {
  const lateralDistance = Math.max(5.2, rMax * 2.8);
  const axialDistance = Math.max(4.8, rMax * 2.35);
  const shaftDistance = Math.max(3.2, rMax * 1.55);

  switch (viewKey) {
    case "front":
      return {
        position: new THREE.Vector3(0, lateralDistance, 0),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };

    case "back":
      return {
        position: new THREE.Vector3(0, -lateralDistance, 0),
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
        position: new THREE.Vector3(lateralDistance, 0, 0),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };

    case "isometric":
      return {
        position: new THREE.Vector3(
          lateralDistance * 0.82,
          lateralDistance * 0.82,
          lateralDistance * 0.62
        ),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };

    case "shaft":
      return {
        position: new THREE.Vector3(0, 0, shaftDistance),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 1, 0),
      };

    case "reset":
    default:
      return {
        position: new THREE.Vector3(0, 5.2, 0),
        target: new THREE.Vector3(0, 0, 0),
        up: new THREE.Vector3(0, 0, 1),
      };
  }
}

function CameraSnapController({ controlsRef, viewRequest, rMax }) {
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

    const initialPreset = getViewPreset("reset", rMax);

    camera.position.copy(initialPreset.position);
    camera.up.copy(initialPreset.up).normalize();
    controls.target.copy(initialPreset.target);
    camera.lookAt(initialPreset.target);
    controls.update();

    hasInitializedRef.current = true;
  }, [camera, controlsRef, rMax]);

  useEffect(() => {
    if (!viewRequest || viewRequest.nonce === 0) {
      return;
    }

    const preset = getViewPreset(viewRequest.key, rMax);

    desiredPositionRef.current.copy(preset.position);
    desiredTargetRef.current.copy(preset.target);
    desiredUpRef.current.copy(preset.up).normalize();
    isAnimatingRef.current = true;
  }, [viewRequest]);

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

  const axisLength = Math.max(3.5, rMax + 1.25);
  const shaftLength = Math.max(5, rMax * 3);
  const controlsRef = useRef(null);

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

      <CameraSnapController
        controlsRef={controlsRef}
        viewRequest={viewRequest}
        rMax={rMax}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
      />
    </>
  );
}