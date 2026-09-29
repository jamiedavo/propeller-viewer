import { useFrame } from "@react-three/fiber";

export function usePropellerSpin(assemblyRef, rpm, isRunning) {
  useFrame((_, delta) => {
    if (!isRunning || !assemblyRef.current || rpm === 0) {
      return;
    }
    const radPerSec = (rpm * Math.PI * 2) / 60;
    assemblyRef.current.rotation.z += radPerSec * delta;
  });
}