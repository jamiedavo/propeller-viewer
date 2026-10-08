export const defaultParams = {
  rMin: 0.05,
  rMax: 1.0,
  n: 1.618,
  bMin: -90,
  bMax: 90,
  bladeCount: 2,
  gridOpacity: 0.3,
  blade1Color: "#3a88c8",
  blade2Color: "#225b8c",
  rpm: 45,
  isRunning: false,
  showProbe: false,
  showIsoR: false,
  showIsoB: false,
  showCylCut: false,
  showEdges: true,
  showFlow: false,
  solidBlade: false,
  bladeThickness: 0.02,
  showShaft: true,
  shaftRatio: 0.06, // shaft diameter as a fraction of tip radius
  showThrustVector: true,
  colorMode: "dualtone",
  probeU: 0.50,
  probeV: 0.50,
  probeVectorScale: 0.35,
};

export const paramRanges = {
  // Unlocked from 5mm (0.005m) to 5.0m
  r: { min: 0.005, max: 5.0, step: 0.005, minSpan: 0.01 },
  n: { min: 0.2, max: 3.5, step: 0.001 },
  b: { min: -90, max: 90, step: 1, minSpan: 2 },
  bladeCount: { min: 1, max: 8, options: [1, 2, 3, 4, 5, 6, 8] },
  gridOpacity: { min: 0, max: 1, step: 0.02 },
  rpm: { min: -250, max: 250, step: 5 },
  probe: { min: 0, max: 1, step: 0.01 },
  bladeThickness: { min: 0.001, max: 0.12, step: 0.001 },
  shaftRatio: { min: 0.02, max: 0.2, step: 0.005 },
  colorModes: [
    { key: "dualtone", label: "Dual-Tone Shaded" },
    { key: "pitch", label: "Local Pitch Angle Heatmap" },
    { key: "radius", label: "Cylindrical Radius Heatmap" },
    { key: "thrust", label: "Axial Normal (Thrust) Heatmap" },
    { key: "wireframe", label: "Parametric Mesh Grid" },
  ],
};

export const sceneDefaults = {
  cameraFov: 42,
  startupView: "side",
};

export const validationConfig = {
  epsilon: 1e-4,
  sphereSampleCount: 50,
  drawingMatchSampleDegrees: [-60, -30, 0, 30, 60],
};

export const meshConfig = {
  radialSegments: 60,
  angularSegments: 60,
};