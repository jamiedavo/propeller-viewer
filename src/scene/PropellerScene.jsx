import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import BladeAssembly from "./BladeAssembly";
import SceneAxes from "./SceneAxes";
import ShaftReference from "./ShaftReference";

/**
 * Fully auto-scales camera distances whether rMax is 0.05m (50mm) or 4.0m.
 */
/**
 * Distance at which a sphere of radius r fits fully in view, for the
 * current camera FOV and window aspect (so it works on tall and wide screens).
 */
function fitDistance(r, camera) {
  const vFov = (camera.fov * Math.PI) / 180;
  const aspect = camera.aspect || 1;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const limiting = Math.min(vFov, hFov);
  return (r * 1.35) / Math.sin(limiting / 2);
}

function getViewPreset(viewKey, rMax, camera) {
  const r = Math.max(0.04, rMax);
  const d = fitDistance(r, camera);
  const lateral = d;
  const axial = d;
  const iso = new THREE.Vector3(1, 0.9, 0.75).normalize().multiplyScalar(d);

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
      return { position: new THREE.Vector3(r * 0.08, 0, axial * 1.1), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 1, 0) };
    case "isometric":
    case "reset":
    default:
      return { position: iso, target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 0, 1) };
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
    const preset = getViewPreset("isometric", rMax, camera);
    camera.position.copy(preset.position);
    camera.up.copy(preset.up);
    controlsRef.current.target.copy(preset.target);
    camera.lookAt(preset.target);
    controlsRef.current.update();
    initialized.current = true;
  }, [camera, controlsRef, rMax]);

  useEffect(() => {
    if (!viewRequest || viewRequest.nonce === 0) return;
    const preset = getViewPreset(viewRequest.key, rMax, camera);
    targetPos.current.copy(preset.position);
    targetLook.current.copy(preset.target);
    targetUp.current.copy(preset.up);
    animating.current = true;
  }, [viewRequest, rMax, camera]);

  useFrame((_, delta) => {
    if (!animating.current || !controlsRef.current) return;
    const t = 1 - Math.exp(-delta * 9);
    camera.position.lerp(targetPos.current, t);
    controlsRef.current.target.lerp(targetLook.current, t);
    camera.up.lerp(targetUp.current, t).normalize();
    camera.lookAt(controlsRef.current.target);
    controlsRef.current.update();

    if (camera.position.distanceToSquared(targetPos.current) < 1e-5) {
      camera.position.copy(targetPos.current);
      controlsRef.current.target.copy(targetLook.current);
      animating.current = false;
    }
  });

  return null;
}

function SlipstreamFlow({ rMax, bladeCount, isRunning, rpm }) {
  const dir = rpm >= 0 ? 1 : -1;

  const streamlines = useMemo(() => {
    const lines = [];
    const numRibbons = bladeCount * 2;
    const steps = 36;
    const lengthZ = rMax * 2.5;

    for (let k = 0; k < numRibbons; k++) {
      const angle0 = (k * 2 * Math.PI) / numRibbons;
      const radius = rMax * 0.85;
      const pts = [];

      for (let s = -8; s <= steps; s++) {
        const frac = s / steps;
        const z = frac * lengthZ;
        const contraction = 1 - 0.16 * Math.tanh(frac * 2.2);
        const theta = angle0 + frac * 3.2 * dir;
        pts.push([
          radius * contraction * Math.cos(theta),
          radius * contraction * Math.sin(theta),
          -dir * z,
        ]);
      }
      lines.push(pts);
    }
    return lines;
  }, [rMax, bladeCount, dir]);

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

function ThrustVector({ rMax, rpm }) {
  const dir = rpm >= 0 ? 1 : -1;
  const arrowLen = Math.max(0.04, rMax * 0.55);
  const arrowRadius = Math.max(0.002, rMax * 0.02);
  const rotX = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  const zBase = dir * (arrowLen * 0.5 + rMax * 0.1);

  return (
    <group position={[0, 0, zBase]}>
      <mesh rotation={[rotX, 0, 0]}>
        <cylinderGeometry args={[arrowRadius, arrowRadius, arrowLen, 16]} />
        <meshStandardMaterial color="#00e676" emissive="#00c853" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0, dir * (arrowLen * 0.5 + arrowRadius * 3.5)]} rotation={[rotX, 0, 0]}>
        <coneGeometry args={[arrowRadius * 3, arrowRadius * 7, 16]} />
        <meshStandardMaterial color="#00e676" emissive="#00c853" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export default function PropellerScene({ params, viewRequest, onGeometryReady }) {
  const { rMax, gridOpacity, isRunning, rpm, bladeCount, showFlow, showThrustVector, showShaft, shaftRatio } = params;

  const controlsRef = useRef(null);
  const gridSize = Math.max(0.3, rMax * 4.0);
  const gridDivs = Math.max(10, Math.round(gridSize / Math.max(0.05, rMax * 0.2)));

  return (
    <>
      <color attach="background" args={["#0c0f16"]} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#bcd7ff", "#080c14", 0.7]} />
      <directionalLight position={[6, 8, 7]} intensity={1.15} />
      <directionalLight position={[-6, -4, 5]} intensity={0.4} />
      <directionalLight position={[0, 0, -6]} intensity={0.35} />

      <gridHelper
        args={[gridSize, gridDivs, "#3a4459", "#181f2c"]}
        rotation={[Math.PI / 2, 0, 0]}
        material-transparent
        material-opacity={gridOpacity}
        material-depthWrite={false}
      />

      <SceneAxes length={Math.max(0.1, rMax * 1.4)} />

      {showShaft && <ShaftReference length={rMax * 2} radius={(rMax * shaftRatio) / 2} />}

      {showFlow && isRunning && (
        <SlipstreamFlow rMax={rMax} bladeCount={bladeCount} isRunning={isRunning} rpm={rpm} />
      )}

      {showThrustVector && isRunning && (
        <ThrustVector rMax={rMax} rpm={rpm} />
      )}

      <BladeAssembly {...params} onGeometryReady={onGeometryReady} />

      <CameraSnapController
        controlsRef={controlsRef}
        viewRequest={viewRequest}
        rMax={rMax}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={Math.max(0.02, rMax * 0.3)}
        maxDistance={Math.max(0.5, rMax * 14)}
        target={[0, 0, 0]}
      />
    </>
  );
}