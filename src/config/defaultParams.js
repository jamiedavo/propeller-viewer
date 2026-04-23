export const paramRanges = {
  n: { min: -6, max: 6, step: 0.01 },
  r: { min: 0.05, max: 3.0, step: 0.01, minSpan: 0.05 },
  b: { min: -90, max: 90, step: 1, minSpan: 2 },
  gridOpacity: { min: 0, max: 1, step: 0.01 },
  rpm: { min: 0, max: 300, step: 1 },
  probe: { min: 0, max: 1, step: 0.01 },
};

export const defaultParams = {
  // Core parametric blade controls
  n: 2.4,
  rMin: 0.05,
  rMax: 2.0,
  bMin: -90,
  bMax: 90,

  // Visual controls
  gridOpacity: 0.22,
  blade1Color: "#5f8fa6",
  blade2Color: "#9a6771",

  // Inspection controls
  showProbe: true,
  showIsoR: false,
  showIsoB: false,
  probeU: 0.72,
  probeV: 0.66,
  probeVectorScale: 0.32,

  // Motion controls
  rpm: 60,
  isRunning: false,
};

export const sceneDefaults = {
  startupView: "isometric",
  cameraFov: 64,
};

export const validationConfig = {
  epsilon: 1e-6,
  sphereSampleCount: 25,
  drawingMatchSampleDegrees: [-90, -60, -30, 0, 30, 60, 90],
};

export const meshConfig = {
  radialSegments: 48,
  angularSegments: 160,
};