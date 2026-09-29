export const defaultParams = {
  rMin: 0.35,
  rMax: 2.1,
  n: 1.0,
  bMin: 5,
  bMax: 65,
  bladeCount: 2,
  gridOpacity: 0.3,
  blade1Color: "#3a88c8",
  blade2Color: "#225b8c",
  rpm: 45,
  isRunning: false,
  showProbe: true,
  showIsoR: true,
  showIsoB: true,
  showCylCut: true,
  showEdges: true,
  showFlow: false,
  solidBlade: false,
  bladeThickness: 0.035,
  showHub: true,
  showThrustVector: true,
  colorMode: "dualtone", // 'dualtone' | 'pitch' | 'radius' | 'thrust' | 'wireframe'
  probeU: 0.55,
  probeV: 0.45,
  probeVectorScale: 0.35,
};

export const paramRanges = {
  r: { min: 0.1, max: 4.5, step: 0.05, minSpan: 0.2 },
  n: { min: 0.2, max: 3.5, step: 0.05 },
  b: { min: 1, max: 80, step: 1, minSpan: 5 },
  bladeCount: { min: 1, max: 8, options: [1, 2, 3, 4, 5, 6, 8] },
  gridOpacity: { min: 0, max: 1, step: 0.02 },
  rpm: { min: -250, max: 250, step: 5 },
  probe: { min: 0, max: 1, step: 0.01 },
  bladeThickness: { min: 0.005, max: 0.12, step: 0.005 },
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
  startupView: "isometric",
};

export const validationConfig = {
  epsilon: 1e-4,
  sphereSampleCount: 50,
  drawingMatchSampleDegrees: [5, 15, 30, 45, 60, 75],
};

export const meshConfig = {
  radialSegments: 60,
  angularSegments: 60,
};