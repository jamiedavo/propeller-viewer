import * as THREE from "three";
import { clamp, degToRad, lerp, surfaceNormal, surfacePoint, cylindricalPitchAngleDeg } from "./surfaceMath";

/**
 * Builds mathematical camber sheet or a 100% watertight manifold solid blade.
 */
export function buildBladeSurfaceData({
  rMin,
  rMax,
  n,
  bMin,
  bMax,
  radialSegments = 50,
  angularSegments = 50,
  solidBlade = false,
  bladeThickness = 0.035,
}) {
  const bMinRad = degToRad(bMin);
  const bMaxRad = degToRad(bMax);

  if (!solidBlade) {
    // Exact mathematical camber sheet
    const vertexCount = (radialSegments + 1) * (angularSegments + 1);
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const colors = new Float32Array(vertexCount * 3);
    const indices = [];

    let ptr = 0;
    let ptr2 = 0;
    let ptrCol = 0;

    for (let i = 0; i <= radialSegments; i++) {
      const u = i / radialSegments;
      const r = lerp(rMin, rMax, u);

      for (let j = 0; j <= angularSegments; j++) {
        const v = j / angularSegments;
        const b = lerp(bMinRad, bMaxRad, v);

        const p = surfacePoint(r, b, n);
        const norm = surfaceNormal(r, b, n);

        positions[ptr] = p.x;
        positions[ptr + 1] = p.y;
        positions[ptr + 2] = p.z;

        normals[ptr] = norm.x;
        normals[ptr + 1] = norm.y;
        normals[ptr + 2] = norm.z;
        ptr += 3;

        uvs[ptr2] = u;
        uvs[ptr2 + 1] = v;
        ptr2 += 2;

        const pitchDeg = cylindricalPitchAngleDeg(b, n);
        const normPitch = clamp((pitchDeg - 30) / 55, 0, 1);
        colors[ptrCol] = normPitch;
        colors[ptrCol + 1] = 0.3 * (1 - normPitch);
        colors[ptrCol + 2] = 1 - normPitch;
        ptrCol += 3;
      }
    }

    const rowStride = angularSegments + 1;
    for (let i = 0; i < radialSegments; i++) {
      for (let j = 0; j < angularSegments; j++) {
        const a = i * rowStride + j;
        const bIdx = a + 1;
        const c = (i + 1) * rowStride + j;
        const d = c + 1;

        indices.push(a, bIdx, c);
        indices.push(bIdx, d, c);
      }
    }

    return {
      positions,
      normals,
      uvs,
      colors,
      indices: new Uint32Array(indices),
    };
  }

  // 100% Watertight Closed 2-Manifold Solid Blade
  const M = radialSegments;
  const N = angularSegments;
  const gridW = M + 1;
  const gridH = N + 1;
  const numGridPts = gridW * gridH;

  const positions = new Float32Array(numGridPts * 2 * 3);
  const normals = new Float32Array(numGridPts * 2 * 3);
  const uvs = new Float32Array(numGridPts * 2 * 2);
  const colors = new Float32Array(numGridPts * 2 * 3);
  const indices = [];

  const uIdx = (i, j) => i * gridH + j;
  const lIdx = (i, j) => numGridPts + i * gridH + j;

  for (let i = 0; i <= M; i++) {
    const u = i / M;
    const r = lerp(rMin, rMax, u);
    // Spanwise thickness taper with minimum structural tip thickness floor
    const spanThickness = Math.max(0.003, bladeThickness * lerp(1.0, 0.45, u));

    for (let j = 0; j <= N; j++) {
      const v = j / N;
      const b = lerp(bMinRad, bMaxRad, v);

      const p = surfacePoint(r, b, n);
      const norm = surfaceNormal(r, b, n);

      // 4-digit aerodynamic profile with rounded leading edge and peak thickness at 30% chord
      const foilProfile = Math.max(
        0,
        2.969 * Math.sqrt(v) - 1.260 * v - 3.516 * v * v + 2.843 * Math.pow(v, 3) - 1.036 * Math.pow(v, 4)
      );
      const halfThick = Math.max(0.0008, spanThickness * foilProfile * 0.5);

      const upperPtr = uIdx(i, j) * 3;
      const lowerPtr = lIdx(i, j) * 3;

      // Suction (Upper) face (+norm)
      positions[upperPtr] = p.x + norm.x * halfThick;
      positions[upperPtr + 1] = p.y + norm.y * halfThick;
      positions[upperPtr + 2] = p.z + norm.z * halfThick;

      normals[upperPtr] = norm.x;
      normals[upperPtr + 1] = norm.y;
      normals[upperPtr + 2] = norm.z;

      // Pressure (Lower) face (-norm)
      positions[lowerPtr] = p.x - norm.x * halfThick;
      positions[lowerPtr + 1] = p.y - norm.y * halfThick;
      positions[lowerPtr + 2] = p.z - norm.z * halfThick;

      normals[lowerPtr] = -norm.x;
      normals[lowerPtr + 1] = -norm.y;
      normals[lowerPtr + 2] = -norm.z;

      const uvU = uIdx(i, j) * 2;
      const uvL = lIdx(i, j) * 2;
      uvs[uvU] = u;
      uvs[uvU + 1] = v;
      uvs[uvL] = u;
      uvs[uvL + 1] = v;

      const pitchDeg = cylindricalPitchAngleDeg(b, n);
      const normPitch = clamp((pitchDeg - 30) / 55, 0, 1);
      colors[upperPtr] = normPitch;
      colors[upperPtr + 1] = 0.3 * (1 - normPitch);
      colors[upperPtr + 2] = 1 - normPitch;
      colors[lowerPtr] = normPitch * 0.7;
      colors[lowerPtr + 1] = 0.2 * (1 - normPitch);
      colors[lowerPtr + 2] = (1 - normPitch) * 0.7;
    }
  }

  // 1. Upper Face Triangles (Outward normal pointing along +N)
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      indices.push(uIdx(i, j), uIdx(i + 1, j), uIdx(i, j + 1));
      indices.push(uIdx(i + 1, j), uIdx(i + 1, j + 1), uIdx(i, j + 1));
    }
  }

  // 2. Lower Face Triangles (Outward normal pointing along -N)
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      indices.push(lIdx(i, j), lIdx(i, j + 1), lIdx(i + 1, j));
      indices.push(lIdx(i + 1, j), lIdx(i, j + 1), lIdx(i + 1, j + 1));
    }
  }

  // 3. Leading Edge Wall (j = 0)
  for (let i = 0; i < M; i++) {
    indices.push(uIdx(i, 0), lIdx(i, 0), uIdx(i + 1, 0));
    indices.push(lIdx(i, 0), lIdx(i + 1, 0), uIdx(i + 1, 0));
  }

  // 4. Trailing Edge Wall (j = N)
  for (let i = 0; i < M; i++) {
    indices.push(uIdx(i, N), uIdx(i + 1, N), lIdx(i, N));
    indices.push(lIdx(i, N), uIdx(i + 1, N), lIdx(i + 1, N));
  }

  // 5. Root Wall (i = 0)
  for (let j = 0; j < N; j++) {
    indices.push(lIdx(0, j), uIdx(0, j), lIdx(0, j + 1));
    indices.push(uIdx(0, j), uIdx(0, j + 1), lIdx(0, j + 1));
  }

  // 6. Tip Wall (i = M)
  for (let j = 0; j < N; j++) {
    indices.push(lIdx(M, j), lIdx(M, j + 1), uIdx(M, j));
    indices.push(uIdx(M, j), lIdx(M, j + 1), uIdx(M, j + 1));
  }

  return {
    positions,
    normals,
    uvs,
    colors,
    indices: new Uint32Array(indices),
  };
}

/**
 * Downloads standard ASCII STL file of the propeller assembly.
 */
export function exportAssemblyToSTL(geometry, bladeCount, shaft, filename = "parametric_propeller.stl") {
  const posAttr = geometry.getAttribute("position");
  const idxAttr = geometry.getIndex();

  let stl = "solid ParametricPropeller\n";

  for (let b = 0; b < bladeCount; b++) {
    const rotAngle = (2 * Math.PI * b) / bladeCount;
    const cosA = Math.cos(rotAngle);
    const sinA = Math.sin(rotAngle);

    // The app works in metres; STL has no units and slicers/CAD read it as
    // millimetres, so scale by 1000 on the way out.
    const MM = 1000;
    const transform = (v) => ({
      x: (v.x * cosA - v.y * sinA) * MM,
      y: (v.x * sinA + v.y * cosA) * MM,
      z: v.z * MM,
    });

    const triCount = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;

    for (let t = 0; t < triCount; t++) {
      const i1 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
      const i2 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
      const i3 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;

      const p1 = transform(new THREE.Vector3().fromBufferAttribute(posAttr, i1));
      const p2 = transform(new THREE.Vector3().fromBufferAttribute(posAttr, i2));
      const p3 = transform(new THREE.Vector3().fromBufferAttribute(posAttr, i3));

      const cb = new THREE.Vector3(p3.x - p2.x, p3.y - p2.y, p3.z - p2.z);
      const ab = new THREE.Vector3(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
      cb.cross(ab).normalize();

      stl += `  facet normal ${cb.x.toExponential(6)} ${cb.y.toExponential(6)} ${cb.z.toExponential(6)}\n`;
      stl += "    outer loop\n";
      stl += `      vertex ${p1.x.toExponential(6)} ${p1.y.toExponential(6)} ${p1.z.toExponential(6)}\n`;
      stl += `      vertex ${p2.x.toExponential(6)} ${p2.y.toExponential(6)} ${p2.z.toExponential(6)}\n`;
      stl += `      vertex ${p3.x.toExponential(6)} ${p3.y.toExponential(6)} ${p3.z.toExponential(6)}\n`;
      stl += "    endloop\n";
      stl += "  endfacet\n";
    }
  }

  // Optional straight shaft along z, from -length/2 to +length/2 (closed cylinder)
  if (shaft) {
    const MM = 1000;
    const SEG = 48;
    const R = shaft.radius * MM;
    const h = (shaft.length * MM) / 2;
    const ring = (k, z) => [R * Math.cos((2 * Math.PI * k) / SEG), R * Math.sin((2 * Math.PI * k) / SEG), z];
    const facet = (a, b, c) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      let out = `  facet normal ${nx.toExponential(6)} ${ny.toExponential(6)} ${nz.toExponential(6)}\n    outer loop\n`;
      for (const p of [a, b, c]) out += `      vertex ${p[0].toExponential(6)} ${p[1].toExponential(6)} ${p[2].toExponential(6)}\n`;
      return out + "    endloop\n  endfacet\n";
    };
    for (let k = 0; k < SEG; k++) {
      const b0 = ring(k, -h), b1 = ring(k + 1, -h), t0 = ring(k, h), t1 = ring(k + 1, h);
      stl += facet(b0, b1, t1) + facet(b0, t1, t0); // side (outward)
      stl += facet([0, 0, h], t0, t1); // top cap (+z)
      stl += facet([0, 0, -h], b1, b0); // bottom cap (-z)
    }
  }

  stl += "endsolid ParametricPropeller\n";

  const blob = new Blob([stl], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}