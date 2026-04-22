import { degToRad, surfaceFrame } from "./surfaceMath";

/**
 * Builds one sampled parametric blade surface.
 * Output is raw geometry data only.
 */
export function buildBladeSurfaceData({
  rMin,
  rMax,
  n,
  bMin,
  bMax,
  radialSegments = 40,
  angularSegments = 120,
}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const bStart = degToRad(bMin);
  const bEnd = degToRad(bMax);

  for (let i = 0; i <= radialSegments; i += 1) {
    const u = i / radialSegments;
    const r = rMin + (rMax - rMin) * u;

    for (let j = 0; j <= angularSegments; j += 1) {
      const v = j / angularSegments;
      const b = bStart + (bEnd - bStart) * v;

      const frame = surfaceFrame(r, b, n);
      positions.push(frame.point.x, frame.point.y, frame.point.z);
      normals.push(frame.normal.x, frame.normal.y, frame.normal.z);
      uvs.push(u, v);
    }
  }

  const columns = angularSegments + 1;

  for (let i = 0; i < radialSegments; i += 1) {
    for (let j = 0; j < angularSegments; j += 1) {
      const a = i * columns + j;
      const b = a + 1;
      const c = (i + 1) * columns + j;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}
