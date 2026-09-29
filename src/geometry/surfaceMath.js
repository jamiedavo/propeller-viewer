/**
 * Governing Mathematical Utilities & Analytical Differential Geometry
 * Fully supports millimeter scales and Dad's full -89° to +89° domain
 */

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v) {
  const len = length(v);
  if (len < 1e-12) return { x: 0, y: 0, z: 1 };
  return scale(v, 1 / len);
}

export function surfacePoint(r, b, n) {
  const cosB = Math.cos(b);
  const sinB = Math.sin(b);
  const nb = n * b;
  const cosNB = Math.cos(nb);
  const sinNB = Math.sin(nb);

  return {
    x: r * cosB * cosNB,
    y: r * cosB * sinNB,
    z: r * sinB,
  };
}

export function surfaceDerivatives(r, b, n) {
  const cosB = Math.cos(b);
  const sinB = Math.sin(b);
  const nb = n * b;
  const cosNB = Math.cos(nb);
  const sinNB = Math.sin(nb);

  const tangentR = {
    x: cosB * cosNB,
    y: cosB * sinNB,
    z: sinB,
  };

  const tangentB = {
    x: -r * (sinB * cosNB + n * cosB * sinNB),
    y: -r * (sinB * sinNB - n * cosB * cosNB),
    z: r * cosB,
  };

  return { tangentR, tangentB };
}

export function surfaceNormal(r, b, n) {
  const cosB = Math.cos(b);
  const sinB = Math.sin(b);
  const nb = n * b;
  const cosNB = Math.cos(nb);
  const sinNB = Math.sin(nb);

  const k = n * sinB * cosB;
  const rawNx = sinNB - k * cosNB;
  const rawNy = -(cosNB + k * sinNB);
  const rawNz = n * cosB * cosB;

  const len = Math.sqrt(1 + n * n * cosB * cosB);

  return {
    x: rawNx / len,
    y: rawNy / len,
    z: rawNz / len,
  };
}

export function cylindricalPitchAngleDeg(bRad, n) {
  const cosB = Math.cos(bRad);
  if (Math.abs(cosB) < 1e-6) return 90;
  return radToDeg(Math.atan(1 / (n * cosB * cosB)));
}

export function cylindricalGeometricPitch(r, bRad, n) {
  const cosB = Math.cos(bRad);
  if (Math.abs(cosB) < 1e-6 || n <= 0) return 0;
  return (2 * Math.PI * r) / (n * cosB);
}

export function surfaceFrame(r, bDeg, n, vectorScale = 0.4) {
  const b = degToRad(bDeg);
  const pt = surfacePoint(r, b, n);
  const { tangentR, tangentB } = surfaceDerivatives(r, b, n);
  const norm = surfaceNormal(r, b, n);

  const localRadius = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
  const pitchAngleDeg = cylindricalPitchAngleDeg(b, n);
  const geometricPitch = cylindricalGeometricPitch(r, b, n);

  return {
    point: pt,
    r,
    bDeg,
    bRad: b,
    localRadius,
    tangentR,
    tangentRUnit: normalize(tangentR),
    tangentB,
    tangentBUnit: normalize(tangentB),
    normal: norm,
    pitchAngleDeg,
    geometricPitch,
    vectorScale,
  };
}

export function surfaceParamsFromUV(params, u, v) {
  const r = lerp(params.rMin, params.rMax, clamp(u, 0, 1));
  const bDeg = lerp(params.bMin, params.bMax, clamp(v, 0, 1));
  return { r, bDeg };
}

export function surfaceFrameFromUV(params, u, v) {
  const { r, bDeg } = surfaceParamsFromUV(params, u, v);
  return surfaceFrame(r, bDeg, params.n, params.probeVectorScale || 0.4);
}

export function clampSurfaceParams(p) {
  // Clamping down to 5mm (0.005m)
  const rMin = Math.max(0.005, Math.min(p.rMin, p.rMax - 0.01));
  const rMax = Math.max(rMin + 0.01, Math.min(10.0, p.rMax));

  // Clamping from -89 to +89
  const bMin = Math.max(-89, Math.min(p.bMin, p.bMax - 1));
  const bMax = Math.max(bMin + 1, Math.min(89, p.bMax));

  const n = Math.max(0.1, Math.min(4.0, p.n));
  const bladeCount = Math.max(1, Math.min(8, Math.round(p.bladeCount || 2)));

  return {
    ...p,
    rMin,
    rMax,
    bMin,
    bMax,
    n,
    bladeCount,
  };
}

export function calculateAeroMetrics(params) {
  const { rMin, rMax, bMin, bMax, n, bladeCount, rpm } = params;

  const b0 = degToRad(bMin);
  const b1 = degToRad(bMax);
  const steps = 60;
  let integralChord = 0;

  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const midB = b0 + (b1 - b0) * (t0 + t1) * 0.5;
    const cosB = Math.cos(midB);
    const ds_db = Math.sqrt(1 + n * n * cosB * cosB);
    integralChord += ds_db * ((b1 - b0) / steps);
  }

  const rootChord = rMin * integralChord;
  const tipChord = rMax * integralChord;
  const meanChord = ((rMin + rMax) * 0.5) * integralChord;

  const bladeArea = 0.5 * (rMax * rMax - rMin * rMin) * integralChord;
  const totalBladeArea = bladeArea * bladeCount;

  const maxCosB = (b0 <= 0 && b1 >= 0) ? 1.0 : Math.max(Math.cos(b0), Math.cos(b1));
  const tipCylRadius = rMax * maxCosB;
  const diskArea = Math.PI * tipCylRadius * tipCylRadius;
  const ear = diskArea > 1e-6 ? totalBladeArea / diskArea : 0;

  const minPitchAngleDeg = cylindricalPitchAngleDeg(Math.min(Math.abs(b0), Math.abs(b1)), n);
  const maxPitchAngleDeg = cylindricalPitchAngleDeg(Math.max(Math.abs(b0), Math.abs(b1)), n);

  const meanB = 0.5 * (b0 + b1);
  const meanR = 0.5 * (rMin + rMax);
  const meanGeometricPitch = cylindricalGeometricPitch(meanR, meanB, n);

  const rps = Math.abs(rpm) / 60;
  const tipSpeed = 2 * Math.PI * rps * tipCylRadius;
  const theoreticalSpeedMean = meanGeometricPitch * rps;

  return {
    rootChord,
    tipChord,
    meanChord,
    bladeArea,
    totalBladeArea,
    diskArea,
    ear,
    minPitchAngleDeg,
    maxPitchAngleDeg,
    meanGeometricPitch,
    tipCylRadius,
    tipSpeed,
    theoreticalSpeedMean,
  };
}