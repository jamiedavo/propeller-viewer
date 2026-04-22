import { useFrame } from "@react-three/fiber";

/**
 * Rotates the full propeller assembly around the z-axis.
 * Animation stays separate from geometry generation.
 */
export function usePropellerSpin(groupRef, rpm, isRunning) {
  useFrame((_, delta) => {
    if (!groupRef.current || !isRunning || rpm === 0) {
      return;
    }

    const angularSpeed = (rpm * Math.PI * 2) / 60;
    groupRef.current.rotation.z += angularSpeed * delta;
  });
}
