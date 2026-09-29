import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import BladeAssembly from "./BladeAssembly";
import SceneAxes from "./SceneAxes";
import ShaftReference from "./ShaftReference";

function getViewMetrics(rMax) {
  const radius = Math.max(0.5, rMax);
  return {
    lateral: Math.max(5.2, radius * 2.6),
    axial: Math.max(4.6, radius * 2.3),
    isometric: new THREE.Vector3(radius * 2.2, radius * 1.8, radius * 1.5),
  };
}

function getViewPreset(viewKey, rMax) {
  const { lateral, axial, isometric } = getViewMetrics(rMax);

  switch (viewKey) {
    case "front":
      return { position: new THREE.Vector3(0, lateral, 0), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 0, 1) };
    case "back":
      return { position: new THREE.Vector3(0, -lateral, 0), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 0, 1) };
    case "top":
      return { position: new THREE.Vector3(0, 0, axial), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 1, 0) };
    case "bottom":
      return { position: new THREE.Vector3(0, 0, -axial), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 1, 0) };
    case "side":
      return { position: new THREE.Vector3(lateral, 0, 0), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 0, 1) };
    case "shaft":
      return { position: new THREE.Vector3(0.15, 0, axial * 1.1), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 1, 0) };
    case "isometric":
    case "reset":
    default:
      return { position: isometric, target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 0, 1) };
  }
}

function CameraSnapController({ controlsRef, viewRequest, rMax }) {
  const { camera } = useThree();
  const initialized = useRef(false);
  const animating = useRef(false);
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const targetUp = useRef(new THREE.Vector3(0, 0, 1));

  useEffect(() => {
    if (!controlsRef.current || initialized.current) return;
    const preset = getViewPreset("reset", rMax);
    camera.position.copy(preset.position);
    camera.up.copy(preset.up);
    controlsRef.current.target.copy(preset.target);
    camera.lookAt(preset.target);
    controlsRef.current.update();
    initialized.current = true;
  }, [camera, controlsRef, rMax]);

  useEffect(() => {
    if (!viewRequest || viewRequest.nonce === 0) return;
    const preset = getViewPreset(viewRequest.key, rMax);
    targetPos.current.copy(preset.position);
    targetLook.current.copy(preset.target);
    targetUp.current.copy(preset.up);
    animating.current = true;
  }, [viewRequest, rMax]);

  useFrame((_, delta) => {
    if (!animating.current || !controlsRef.current) return;
    const t = 1 - Math.exp(-delta * 9);
    camera.position.lerp(targetPos.current, t);
    controlsRef.current.target.lerp(targetLook.current, t);
    camera.up.lerp(targetUp.current, t).normalize();
    camera.lookAt(controlsRef.current.target);
    controlsRef.current.update();

    if (camera.position.distanceToSquared(targetPos.current) < 1e-4) {
      camera.position.copy(targetPos.current);
      controlsRef.current.target.copy(targetLook.current);
      animating.current = false;
    }
  });

  return null;
}

/**
 * Helical Slipstream Flow Streamlines through the propeller disc.
 */
function SlipstreamFlow({ rMax, bladeCount, isRunning, rpm }) {
  const streamlines = useMemo(() => {
    const lines = [];
    const numRibbons = bladeCount * 2;
    const steps = 40;
    const lengthZ = rMax * 2.8;

    for (let k = 0; k < numRibbons; k++) {
      const angle0 = (k * 2 * Math.PI) / numRibbons;
      const radius = rMax * 0.88;
      const pts = [];

      for (let s = -15; s <= steps; s++) {
        const frac = s / steps;
        const z = frac * lengthZ;
        const contraction = 1 - 0.15 * Math.tanh(frac * 2);
        const theta = angle0 + frac * 3.5;
        pts.push([
          radius * contraction * Math.cos(theta),
          radius * contraction * Math.sin(theta),
          -z,
        ]);
      }
      lines.push(pts);
    }
    return lines;
  }, [rMax, bladeCount]);

  const flowRef = useRef();

  useFrame((_, delta) => {
    if (!flowRef.current || !isRunning || rpm === 0) return;
    flowRef.current.rotation.z += ((rpm * Math.PI * 2) / 60) * delta;
  });

  return (
    <group ref={flowRef}>
      {streamlines.map((pts, i) => (
        <Line key={i} points={pts} color="#4fc3f7" transparent opacity={0.35} lineWidth={1.5} />
      ))}
    </group>
  );
}

/**
 * Thrust Vector Arrow along shaft axis.
 */
function ThrustVector({ rMax, rpm }) {
  const dir = rpm >= 0 ? 1 : -1;
  const arrowLen = Math.max(0.6, rMax * 0.7);

  return (
    <group position={[0, 0, dir * (arrowLen + 0.3)]}>
      <mesh rotation={[dir > 0 ? 0 : Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, arrowLen, 16]} />
        <meshStandardMaterial color="#00e676" emissive="#00c853" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0, dir * 0.5 * arrowLen]} rotation={[dir > 0 ? 0 : Math.PI, 0, 0]}>
        <coneGeometry args={[0.07, 0.18, 16]} />
        <meshStandardMaterial color="#00e676" emissive="#00c853" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export default function PropellerScene({ params, viewRequest, onGeometryReady }) {
  const { rMax, bMin, bMax, rMin, gridOpacity, isRunning, rpm, bladeCount, showFlow, showThrustVector, showHub } = params;

  const controlsRef = useRef(null);
  const gridSize = Math.max(8, rMax * 5.0);
  const gridDivs = Math.max(10, Math.round(gridSize));

  return (
    <>
      <color attach="background" args={["#0c0f16"]} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#bcd7ff", "#080c14", 0.7]} />
      <directionalLight position={[6, 8, 7]} intensity={1.15} castShadow />
      <directionalLight position={[-6, -4, 5]} intensity={0.4} />
      <directionalLight position={[0, 0, -6]} intensity={0.35} />

      {/* Grid aligned on XY Propeller Disc Plane (z=0) */}
      <gridHelper
        args={[gridSize, gridDivs, "#3a4459", "#181f2c"]}
        rotation={[Math.PI / 2, 0, 0]}
        material-transparent
        material-opacity={gridOpacity}
        material-depthWrite={false}
      />

      <SceneAxes length={Math.max(3.8, rMax * 1.6)} />

      {showHub && (
        <ShaftReference
          length={Math.max(6.0, rMax * 3.5)}
          hubRadius={rMin * 0.95}
          hubLength={rMax * 0.28}
        />
      )}

      {showFlow && isRunning && (
        <SlipstreamFlow rMax={rMax} bladeCount={bladeCount} isRunning={isRunning} rpm={rpm} />
      )}

      {showThrustVector && isRunning && (
        <ThrustVector rMax={rMax} rpm={rpm} isRunning={isRunning} />
      )}

      <BladeAssembly {...params} onGeometryReady={onGeometryReady} />

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
        minDistance={Math.max(1.5, rMax * 0.8)}
        maxDistance={Math.max(18, rMax * 9)}
        target={[0, 0, 0]}
      />
    </>
  );
}