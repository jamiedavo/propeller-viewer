import { paramRanges } from "../config/defaultParams";

/**
 * Geometry utilities for the parametric blade:
 *
 * x = r*cos(b)*cos(n*b)
 * y = r*cos(b)*sin(n*b)
 * z = r*sin(b)
 *
 * UI angles are in degrees.
 * Trig math uses radians internally.
 */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

export function add(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

export function scale(v, s) {
  return {
    x: v.x * s,
    y: v.y * s,
    z: v.z * s,
  };
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
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize(v) {
  const vLength = length(v);

  if (vLength < 1e-12) {
    return { x: 0, y: 0, z: 1 };
  }

  return scale(v, 1 / vLength);
}

export function surfacePoint(r, b, n) {
  return {
    x: r * Math.cos(b) * Math.cos(n * b),
    y: r * Math.cos(b) * Math.sin(n * b),
    z: r * Math.sin(b),
  };
}

export function surfaceDerivatives(r, b, n) {
  const cosB = Math.cos(b);
  const sinB = Math.sin(b);
  const cosNB = Math.cos(n * b);
  const sinNB = Math.sin(n * b);

  const tangentR = {
    x: cosB * cosNB,
    y: cosB * sinNB,
    z: sinB,
  };

  const tangentB = {
    x: r * (-sinB * cosNB - n * cosB * sinNB),
    y: r * (-sinB * sinNB + n * cosB * cosNB),
    z: r * cosB,
  };

  return { tangentR, tangentB };
}

export function surfaceFrame(r, b, n) {
  const point = surfacePoint(r, b, n);
  const { tangentR, tangentB } = surfaceDerivatives(r, b, n);
  const normal = normalize(cross(tangentR, tangentB));

  return {
    point,
    tangentR,
    tangentB,
    tangentRUnit: normalize(tangentR),
    tangentBUnit: normalize(tangentB),
    normal,
  };
}

export function radiusFromAxis(point) {
  return Math.sqrt(point.x * point.x + point.y * point.y);
}

export function surfaceParamsFromUV(params, u, v) {
  const safeU = clamp01(u);
  const safeV = clamp01(v);
  const r = lerp(params.rMin, params.rMax, safeU);
  const bDeg = lerp(params.bMin, params.bMax, safeV);
  const b = degToRad(bDeg);

  return { u: safeU, v: safeV, r, bDeg, b };
}

export function surfaceFrameFromUV(params, u, v) {
  const uv = surfaceParamsFromUV(params, u, v);
  const frame = surfaceFrame(uv.r, uv.b, params.n);

  return {
    ...uv,
    ...frame,
    localRadius: radiusFromAxis(frame.point),
  };
}

/**
 * Clamp and sanitize user-facing parameters.
 * Domain controls are now intentionally user-adjustable.
 */
export function clampSurfaceParams(params) {
  const next = { ...params };

  delete next.bladeOpacity;

  const toNumber = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  next.n = clamp(toNumber(next.n, 1), paramRanges.n.min, paramRanges.n.max);

  next.gridOpacity = clamp(
    toNumber(next.gridOpacity, 0.35),
    paramRanges.gridOpacity.min,
    paramRanges.gridOpacity.max
  );

  next.rMin = clamp(
    toNumber(next.rMin, 0.05),
    paramRanges.r.min,
    paramRanges.r.max - paramRanges.r.minSpan
  );

  next.rMax = clamp(
    toNumber(next.rMax, 2.0),
    next.rMin + paramRanges.r.minSpan,
    paramRanges.r.max
  );

  next.bMin = clamp(
    toNumber(next.bMin, -90),
    paramRanges.b.min,
    paramRanges.b.max - paramRanges.b.minSpan
  );

  next.bMax = clamp(
    toNumber(next.bMax, 90),
    next.bMin + paramRanges.b.minSpan,
    paramRanges.b.max
  );

  next.probeU = clamp01(toNumber(next.probeU, 0.72));
  next.probeV = clamp01(toNumber(next.probeV, 0.66));

  next.probeVectorScale = clamp(toNumber(next.probeVectorScale, 0.38), 0.1, 1.2);
  next.rpm = clamp(toNumber(next.rpm, 60), paramRanges.rpm.min, paramRanges.rpm.max);

  next.isRunning = Boolean(next.isRunning);
  next.showProbe = Boolean(next.showProbe);
  next.showIsoR = Boolean(next.showIsoR);
  next.showIsoB = Boolean(next.showIsoB);

  return next;
}