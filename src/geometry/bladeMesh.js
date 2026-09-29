import * as THREE from "three";
import { degToRad, lerp, surfaceNormal, surfacePoint } from "./surfaceMath";

/**
 * Builds mathematical blade surface data or solid extruded blade data.
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
    // Exact mathematical camber surface
    const vertexCount = (radialSegments + 1) * (angularSegments + 1);
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const customColors = new Float32Array(vertexCount * 3);
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

        const cylR = Math.sqrt(p.x * p.x + p.y * p.y);
        const normCyl = (cylR - rMin * 0.5) / (rMax * 1.05);
        customColors[ptrCol] = normCyl;
        customColors[ptrCol + 1] = 0.5 * (1 - normCyl);
        customColors[ptrCol + 2] = 1 - normCyl;
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
      colors: customColors,
      indices: new Uint32Array(indices),
    };
  }

  // Solid Extruded Blade (Hydrofoil profile offset along ±normal)
  const gridW = radialSegments + 1;
  const gridH = angularSegments + 1;
  const numGridPts = gridW * gridH;

  const positions = new Float32Array(numGridPts * 2 * 3);
  const normals = new Float32Array(numGridPts * 2 * 3);
  const uvs = new Float32Array(numGridPts * 2 * 2);
  const indices = [];

  for (let i = 0; i <= radialSegments; i++) {
    const u = i / radialSegments;
    const r = lerp(rMin, rMax, u);
    const spanThickness = bladeThickness * lerp(1.2, 0.45, u);

    for (let j = 0; j <= angularSegments; j++) {
      const v = j / angularSegments;
      const b = lerp(bMinRad, bMaxRad, v);

      const p = surfacePoint(r, b, n);
      const norm = surfaceNormal(r, b, n);

      // Parabolic foil camber thickness taper
      const foilProfile = 4 * v * (1 - v);
      const halfThick = Math.max(0.001, spanThickness * foilProfile * 0.5);

      const idxUpper = (i * gridH + j) * 3;
      const idxLower = (numGridPts + i * gridH + j) * 3;

      // Suction (top) side
      positions[idxUpper] = p.x + norm.x * halfThick;
      positions[idxUpper + 1] = p.y + norm.y * halfThick;
      positions[idxUpper + 2] = p.z + norm.z * halfThick;

      normals[idxUpper] = norm.x;
      normals[idxUpper + 1] = norm.y;
      normals[idxUpper + 2] = norm.z;

      // Pressure (bottom) side
      positions[idxLower] = p.x - norm.x * halfThick;
      positions[idxLower + 1] = p.y - norm.y * halfThick;
      positions[idxLower + 2] = p.z - norm.z * halfThick;

      normals[idxLower] = -norm.x;
      normals[idxLower + 1] = -norm.y;
      normals[idxLower + 2] = -norm.z;

      const uvIdxUpper = (i * gridH + j) * 2;
      const uvIdxLower = (numGridPts + i * gridH + j) * 2;
      uvs[uvIdxUpper] = u;
      uvs[uvIdxUpper + 1] = v;
      uvs[uvIdxLower] = u;
      uvs[uvIdxLower + 1] = v;
    }
  }

  // Upper & Lower Face Triangles
  for (let i = 0; i < radialSegments; i++) {
    for (let j = 0; j < angularSegments; j++) {
      const a = i * gridH + j;
      const bIdx = a + 1;
      const c = (i + 1) * gridH + j;
      const d = c + 1;

      // Upper face
      indices.push(a, bIdx, c);
      indices.push(bIdx, d, c);

      // Lower face
      const al = numGridPts + a;
      const bl = numGridPts + bIdx;
      const cl = numGridPts + c;
      const dl = numGridPts + d;

      indices.push(al, cl, bl);
      indices.push(bl, cl, dl);
    }
  }

  // Side perimeter skirts (Leading edge, Trailing edge, Root, Tip)
  const addQuad = (p1, p2, p3, p4) => {
    indices.push(p1, p2, p3);
    indices.push(p2, p4, p3);
  };

  // Leading edge (j = 0)
  for (let i = 0; i < radialSegments; i++) {
    const u1 = i * gridH + 0;
    const u2 = (i + 1) * gridH + 0;
    const l1 = numGridPts + u1;
    const l2 = numGridPts + u2;
    addQuad(u1, l1, u2, l2);
  }

  // Trailing edge (j = angularSegments)
  for (let i = 0; i < radialSegments; i++) {
    const u1 = i * gridH + angularSegments;
    const u2 = (i + 1) * gridH + angularSegments;
    const l1 = numGridPts + u1;
    const l2 = numGridPts + u2;
    addQuad(u1, u2, l1, l2);
  }

  // Root edge (i = 0)
  for (let j = 0; j < angularSegments; j++) {
    const u1 = j;
    const u2 = j + 1;
    const l1 = numGridPts + u1;
    const l2 = numGridPts + u2;
    addQuad(u1, u2, l1, l2);
  }

  // Tip edge (i = radialSegments)
  for (let j = 0; j < angularSegments; j++) {
    const u1 = radialSegments * gridH + j;
    const u2 = radialSegments * gridH + j + 1;
    const l1 = numGridPts + u1;
    const l2 = numGridPts + u2;
    addQuad(u1, l1, u2, l2);
  }

  return {
    positions,
    normals,
    uvs,
    colors: new Float32Array(positions.length),
    indices: new Uint32Array(indices),
  };
}

/**
 * Downloads standard ASCII STL file of the propeller assembly for 3D printing/CFD.
 */
export function exportAssemblyToSTL(geometry, bladeCount, filename = "parametric_propeller.stl") {
  const posAttr = geometry.getAttribute("position");
  const idxAttr = geometry.getIndex();

  let stl = "solid ParametricPropeller\n";

  for (let b = 0; b < bladeCount; b++) {
    const rotAngle = (2 * Math.PI * b) / bladeCount;
    const cosA = Math.cos(rotAngle);
    const sinA = Math.sin(rotAngle);

    const transform = (v) => ({
      x: v.x * cosA - v.y * sinA,
      y: v.x * sinA + v.y * cosA,
      z: v.z,
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

  stl += "endsolid ParametricPropeller\n";

  const blob = new Blob([stl], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}