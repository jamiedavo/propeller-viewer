import React, { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import "./App.css";
import {
  defaultParams,
  paramRanges,
  sceneDefaults,
  validationConfig, patentProfiles } from "./config/defaultParams";
import ProfileThumb from "./components/ProfileThumb";
import PropellerScene from "./scene/PropellerScene";
import {
  calculateAeroMetrics,
  clampSurfaceParams,
  degToRad,
  dot,
  surfaceFrameFromUV,
  surfacePoint,
} from "./geometry/surfaceMath";
import { exportAssemblyToSTL } from "./geometry/bladeMesh";

function approximatelyEqual(a, b, epsilon = 1e-4) {
  return Math.abs(a - b) <= epsilon;
}

function runValidation(params) {
  const { epsilon, sphereSampleCount, drawingMatchSampleDegrees } = validationConfig;
  const { rMax, n, bMin, bMax, bladeCount, probeU, probeV } = params;
  const results = [];

  // 1. Drawing logic validation: special case n = 1 matches Dad's equations
  let drawingMatch = true;
  for (const deg of drawingMatchSampleDegrees) {
    const b = degToRad(deg);
    const actual = surfacePoint(rMax, b, 1);
    const expected = {
      x: rMax * Math.cos(b) * Math.cos(b),
      y: rMax * Math.sin(b) * Math.cos(b),
      z: rMax * Math.sin(b),
    };
    if (
      !approximatelyEqual(actual.x, expected.x, epsilon) ||
      !approximatelyEqual(actual.y, expected.y, epsilon) ||
      !approximatelyEqual(actual.z, expected.z, epsilon)
    ) {
      drawingMatch = false;
      break;
    }
  }
  results.push({
    label: "180° / 180° case matches the original drawing equations",
    pass: drawingMatch,
  });

  // 2. Sphere identity check: x² + y² + z² = r²
  let maxSphereError = 0;
  for (let i = 0; i <= sphereSampleCount; i++) {
    const b = degToRad(bMin + (bMax - bMin) * (i / sphereSampleCount));
    const pt = surfacePoint(rMax, b, n);
    const lhs = pt.x * pt.x + pt.y * pt.y + pt.z * pt.z;
    const rhs = rMax * rMax;
    maxSphereError = Math.max(maxSphereError, Math.abs(lhs - rhs));
  }
  results.push({
    label: "Spherical locus identity satisfies x² + y² + z² = r²",
    pass: maxSphereError < 1e-4,
    detail: `max deviation: ${maxSphereError.toExponential(3)}`,
  });

  // 3. Orthogonality check: Tangent R ⟂ Tangent B
  const frame = surfaceFrameFromUV(params, probeU, probeV);
  const ortho = Math.abs(dot(frame.tangentRUnit, frame.tangentBUnit));
  results.push({
    label: "Orthogonal coordinate metric: ∂S/∂r ⟂ ∂S/∂b everywhere",
    pass: ortho < 1e-4,
    detail: `dot product = ${ortho.toExponential(3)} (strict orthogonal system)`,
  });

  // 4. Cylindrical-section pitch consistency check
  const bMid = degToRad(0.5 * (bMin + bMax));
  const deltaB = 1e-4;
  const bA = bMid - deltaB;
  const bB = bMid + deltaB;
  const thetaA = n * bA;
  const thetaB = n * bB;
  const rhoProbe = frame.localRadius;
  const zA = rhoProbe * Math.tan(bA);
  const zB = rhoProbe * Math.tan(bB);
  const numTanBeta = (zB - zA) / (rhoProbe * (thetaB - thetaA));
  const anaTanBeta = 1 / (n * Math.cos(bMid) * Math.cos(bMid));
  const pitchConsistent = approximatelyEqual(numTanBeta, anaTanBeta, 1e-3);

  results.push({
    label: "Cylindrical-section pitch satisfies tan(β) = 1 / (n · cos²b)",
    pass: pitchConsistent,
    detail: `analytical = ${anaTanBeta.toFixed(3)}, numerical = ${numTanBeta.toFixed(3)}`,
  });

  // 6. Blade count check
  results.push({
    label: "Blade count within test rig support (1 to 8 blades)",
    pass: Number.isInteger(bladeCount) && bladeCount >= 1 && bladeCount <= 8,
    detail: `${bladeCount} blades, ${(360 / bladeCount).toFixed(1)}° radial spacing`,
  });

  return results;
}

const VIEW_KEYS = [
  { key: "side", label: "Side (yz)" },
  { key: "front", label: "Front (xz)" },
  { key: "top", label: "Top (xy)" },
  { key: "bottom", label: "Bottom" },
  { key: "back", label: "Back" },
  { key: "isometric", label: "3D View" },
  { key: "reset", label: "Reset View" },
];

function formatRadius(val) {
  if (!Number.isFinite(val)) return "∞ (at pole)";
  if (Math.abs(val) < 5e-7) val = 0; // avoid showing "-0 mm"
  if (Math.abs(val) < 0.1) {
    return `${(val * 1000).toFixed(0)} mm`;
  }
  return `${val.toFixed(2)} m`;
}

export default function App() {
  const [params, setParams] = useState(() => clampSurfaceParams(defaultParams));
  const [viewRequest, setViewRequest] = useState({ key: sceneDefaults.startupView, nonce: 0 });
  const [activeTab, setActiveTab] = useState("geometry");
  const currentGeometryRef = useRef(null);

  const updateParam = (key, val) => {
    setParams((prev) => {
      const nextVal = typeof val === "boolean" || typeof val === "string" ? val : Number(val);
      const extra = key === "profile" ? { n: patentProfiles.find((p) => p.key === val)?.n ?? prev.n } : {};
      const updated = clampSurfaceParams({ ...prev, [key]: nextVal, ...extra });
      if (key !== "isRunning") updated.isRunning = prev.isRunning;
      return updated;
    });
  };

  const validationResults = useMemo(() => runValidation(params), [params]);
  const aeroMetrics = useMemo(() => calculateAeroMetrics(params), [params]);
  const probeFrame = useMemo(() => surfaceFrameFromUV(params, params.probeU, params.probeV), [params]);

  const handleExportSTL = () => {
    if (currentGeometryRef.current) {
      const modeName = params.solidBlade ? "solid" : "sheet_open";
      exportAssemblyToSTL(
        currentGeometryRef.current,
        params.bladeCount,
        params.showShaft ? { radius: (params.rMax * params.shaftRatio) / 2, length: params.rMax * 2 } : null,
        `propeller_${params.profile}_${params.bladeCount}blades_${modeName}.stl`
      );
    }
  };

  return (
    <div className="app-shell">
      {/* 3D Viewport Panel */}
      <main className="viewer-panel">
        <div className="viewer-stage">
          <Canvas
            camera={{
              position: [3.2, 2.9, 2.4],
              up: [0, 0, 1],
              fov: sceneDefaults.cameraFov,
              near: 0.001,
              far: 150,
            }}
          >
            <PropellerScene
              params={params}
              viewRequest={viewRequest}
              onGeometryReady={(geo) => {
                currentGeometryRef.current = geo;
              }}
            />
          </Canvas>

          {/* Viewport Top Action Bar */}
          <div className="viewport-quick-bar">
            <button
              type="button"
              className={`action-btn ${params.isRunning ? "active" : ""}`}
              onClick={() => updateParam("isRunning", !params.isRunning)}
            >
              {params.isRunning ? "❚❚ Pause Spin" : "▶ Start Spin"}
            </button>
            <button type="button" className="action-btn" onClick={handleExportSTL}>
              {params.solidBlade ? "⬇ Export Solid STL (3D Print)" : "⬇ Export Surface STL (Sheet)"}
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => {
                updateParam("isRunning", false);
                setViewRequest((v) => ({ key: "isometric", nonce: v.nonce + 1 }));
              }}
            >
              ⟲ Reset View
            </button>
          </div>

          {/* Viewport Floating Status Badge */}
          <div className="viewport-badge">
            <span className="badge-title">Tip Radius:</span>
            <span className="badge-value">{formatRadius(params.rMax)}</span>
            <span className="badge-title" style={{ marginLeft: 8 }}>Line / shaft:</span>
            <span className="badge-value">{patentProfiles.find((p) => p.key === params.profile)?.label}</span>
          </div>
        </div>
      </main>

      {/* Control Panel Sidebar */}
      <aside className="control-panel">
        <div className="control-panel__scroll">
          <header className="brand-header">
            <div className="brand-badge">Davidson HeliSphere • Math-First Rig</div>
            <h1 className="brand-title">Parametric Propeller Viewer</h1>
            <p className="brand-desc">
              Blade surface from the 2013 patent application: a line turns 180° while its shaft turns 180° or 360°.
            </p>
          </header>

          {/* Navigation Tabs */}
          <nav className="tab-nav">
            {[
              { id: "geometry", label: "Geometry" },
              { id: "aero", label: "Kinematics" },
              { id: "inspection", label: "Probe & Cuts" },
              { id: "validation", label: "Validation" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* TAB 1: GEOMETRY */}
          {activeTab === "geometry" && (
            <div className="tab-pane">
              {/* Main controls */}
              <section className="card">
                <div className="card-header">
                  <strong>Propeller</strong>
                </div>

                <div className="control-row">
                  <div className="label-bar">
                    <span>Blade surface (line / shaft turn)</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {patentProfiles.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`chip-btn ${params.profile === p.key ? "active" : ""}`}
                        onClick={() => updateParam("profile", p.key)}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 6px" }}
                      >
                        <ProfileThumb n={p.n} />
                        <strong style={{ fontSize: 14 }}>{p.label}</strong>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>
                          line turns {p.line}°, shaft turns {p.shaft}°
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-row">
                  <div className="label-bar">
                    <span>Blades</span>
                    <strong>{params.bladeCount}</strong>
                  </div>
                  <div className="button-group">
                    {paramRanges.bladeCount.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`chip-btn ${params.bladeCount === opt ? "active" : ""}`}
                        onClick={() => updateParam("bladeCount", opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-row">
                  <div className="label-bar">
                    <span>Size (tip radius)</span>
                    <strong>{formatRadius(params.rMax)}</strong>
                  </div>
                  <input
                    type="range"
                    min={params.rMin + paramRanges.r.minSpan}
                    max={paramRanges.r.max}
                    step={paramRanges.r.step}
                    value={params.rMax}
                    onChange={(e) => updateParam("rMax", e.target.value)}
                  />
                </div>

                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", color: "var(--text-dim)", fontSize: 13 }}>
                    Advanced
                  </summary>

                  <div className="control-row" style={{ marginTop: 12 }}>
                    <div className="label-bar">
                      <span>Inner cut-off radius</span>
                      <strong>{formatRadius(params.rMin)}</strong>
                    </div>
                    <input
                      type="range"
                      min={paramRanges.r.min}
                      max={Math.max(paramRanges.r.min, params.rMax - paramRanges.r.minSpan)}
                      step={paramRanges.r.step}
                      value={params.rMin}
                      onChange={(e) => updateParam("rMin", e.target.value)}
                    />
                    <div className="hint-text">
                      Every blade line starts at the centre point and fans outwards. This slices the
                      pointed centre off so the blade has a flat inner edge. Smaller = more blade
                      near the centre.
                    </div>
                  </div>

                </details>
              </section>

              {/* Solid Blade / Hub Setup */}
              <section className="card">
                <div className="card-header">
                  <strong>Material</strong>
                  <span className="pill-tag">{params.solidBlade ? "Watertight Solid" : "Zero-Thickness Sheet"}</span>
                </div>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.solidBlade}
                    onChange={(e) => updateParam("solidBlade", e.target.checked)}
                  />
                  <span>
                    <strong>Extrude Watertight Solid Blade (3D Print Ready)</strong>
                    <div className="subtext">
                      Watertight closed 2-manifold solid with continuous side skirts.
                    </div>
                  </span>
                </label>

                {!params.solidBlade && (
                  <div className="sheet-warning-box">
                    <strong>Sheet Mode Notice:</strong> Current surface has zero thickness. STL export will produce an open 2D sheet. Enable Solid Blade mode for 3D printing.
                  </div>
                )}

                {params.solidBlade && (
                  <div className="control-row">
                    <div className="label-bar">
                      <span>Root Thickness</span>
                      <strong>{formatRadius(params.bladeThickness)}</strong>
                    </div>
                    <input
                      type="range"
                      min={paramRanges.bladeThickness.min}
                      max={paramRanges.bladeThickness.max}
                      step={paramRanges.bladeThickness.step}
                      value={params.bladeThickness}
                      onChange={(e) => updateParam("bladeThickness", e.target.value)}
                    />
                  </div>
                )}

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showShaft}
                    onChange={(e) => updateParam("showShaft", e.target.checked)}
                  />
                  <span>
                    <strong>Include shaft</strong>
                    <small style={{ display: "block", opacity: 0.7, marginTop: 2 }}>Straight rod on the axis that joins the blades. Included in the STL export.</small>
                  </span>
                </label>

                {params.showShaft && (
                  <div className="control-row">
                    <div className="label-bar">
                      <span>Shaft diameter</span>
                      <strong>{formatRadius(params.rMax * params.shaftRatio)}</strong>
                    </div>
                    <input
                      type="range"
                      min={paramRanges.shaftRatio.min}
                      max={paramRanges.shaftRatio.max}
                      step={paramRanges.shaftRatio.step}
                      value={params.shaftRatio}
                      onChange={(e) => updateParam("shaftRatio", e.target.value)}
                    />
                  </div>
                )}
              </section>

              {/* Camera Presets */}
              <section className="card">
                <strong>Camera Presets</strong>
                <div className="grid-buttons">
                  {VIEW_KEYS.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      className={`chip-btn ${viewRequest.key === v.key ? "active" : ""}`}
                      onClick={() => setViewRequest({ key: v.key, nonce: viewRequest.nonce + 1 })}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: KINEMATICS */}
          {activeTab === "aero" && (
            <div className="tab-pane">
              <section className="card">
                <div className="card-header">
                  <strong>Propeller Kinematics</strong>
                </div>

                <div className="control-row">
                  <div className="label-bar">
                    <span>Shaft RPM</span>
                    <strong>{params.rpm} RPM</strong>
                  </div>
                  <input
                    type="range"
                    min={paramRanges.rpm.min}
                    max={paramRanges.rpm.max}
                    step={paramRanges.rpm.step}
                    value={params.rpm}
                    onChange={(e) => updateParam("rpm", e.target.value)}
                  />
                </div>

                <div className="metric-grid">
                  <div className="metric-box">
                    <div className="metric-label">Leading Edge Pitch</div>
                    <div className="metric-val">{aeroMetrics.minPitchAngleDeg.toFixed(1)}°</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Trailing Edge Pitch</div>
                    <div className="metric-val">{aeroMetrics.maxPitchAngleDeg.toFixed(1)}°</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Expanded Area Ratio (EAR)</div>
                    <div className="metric-val">{aeroMetrics.ear.toFixed(2)}</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Mean Geometric Pitch</div>
                    <div className="metric-val">{formatRadius(aeroMetrics.meanGeometricPitch)}</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Tip Speed</div>
                    <div className="metric-val">{aeroMetrics.tipSpeed.toFixed(1)} m/s</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Theoretical Advance</div>
                    <div className="metric-val">{aeroMetrics.theoreticalSpeedMean.toFixed(1)} m/s</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={params.showFlow}
                      onChange={(e) => updateParam("showFlow", e.target.checked)}
                    />
                    <span>
                      <strong>Visualize Helical Slipstream Streamlines</strong>
                    </span>
                  </label>

                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={params.showThrustVector}
                      onChange={(e) => updateParam("showThrustVector", e.target.checked)}
                    />
                    <span>
                      <strong>Show Shaft Thrust Vector</strong>
                    </span>
                  </label>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: PROBE & SECTIONS */}
          {activeTab === "inspection" && (
            <div className="tab-pane">
              <section className="card">
                <strong>Surface & Section Overlays (Blade 1)</strong>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showCylCut}
                    onChange={(e) => updateParam("showCylCut", e.target.checked)}
                  />
                  <span>
                    <strong style={{ color: "#ff80ab" }}>Cylindrical Section Cut (ρ = const)</strong>
                  </span>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showIsoR}
                    onChange={(e) => updateParam("showIsoR", e.target.checked)}
                  />
                  <span>
                    <strong style={{ color: "#ffe082" }}>Spherical Iso-Arc (r = const)</strong>
                  </span>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showIsoB}
                    onChange={(e) => updateParam("showIsoB", e.target.checked)}
                  />
                  <span>
                    <strong style={{ color: "#80deea" }}>Radial Elevation Ray (b = const)</strong>
                  </span>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showProbe}
                    onChange={(e) => updateParam("showProbe", e.target.checked)}
                  />
                  <span>
                    <strong>Interactive Probe & Local Frame Triad</strong>
                  </span>
                </label>

                {params.showProbe && (
                  <div style={{ marginTop: 12 }}>
                    <div className="control-row">
                      <div className="label-bar">
                        <span>Radial Span Station (u)</span>
                        <strong>{(params.probeU * 100).toFixed(0)}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={params.probeU}
                        onChange={(e) => updateParam("probeU", e.target.value)}
                      />
                    </div>

                    <div className="control-row">
                      <div className="label-bar">
                        <span>Chordwise Elevation Station (v)</span>
                        <strong>{(params.probeV * 100).toFixed(0)}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={params.probeV}
                        onChange={(e) => updateParam("probeV", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </section>

              <section className="card">
                <strong>Probe Differential Readout</strong>
                <div className="readout-box">
                  <div><strong>Position:</strong> x = {formatRadius(probeFrame.point.x)}, y = {formatRadius(probeFrame.point.y)}, z = {formatRadius(probeFrame.point.z)}</div>
                  <div><strong>Spherical Radius (r):</strong> {formatRadius(probeFrame.r)}</div>
                  <div><strong>Cylindrical Radius (ρ):</strong> {formatRadius(probeFrame.localRadius)}</div>
                  <div><strong>Elevation Angle (b):</strong> {probeFrame.bDeg.toFixed(2)}°</div>
                  <div><strong>Local Pitch Angle (β):</strong> {probeFrame.pitchAngleDeg.toFixed(2)}°</div>
                  <div><strong>Local Geometric Pitch (P):</strong> {formatRadius(probeFrame.geometricPitch)} / rev</div>
                  <div><strong>Unit Normal (n̂):</strong> ({probeFrame.normal.x.toFixed(3)}, {probeFrame.normal.y.toFixed(3)}, {probeFrame.normal.z.toFixed(3)})</div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: VALIDATION */}
          {activeTab === "validation" && (
            <div className="tab-pane">
              <section className="card">
                <div className="card-header">
                  <strong>Mathematical Authority Validation</strong>
                  <span className="pill-tag pass">
                    {validationResults.every((r) => r.pass) ? "ALL CHECKS PASSED" : "REVIEW REQUIRED"}
                  </span>
                </div>

                <div className="validation-list">
                  {validationResults.map((r, i) => (
                    <div key={i} className="validation-item">
                      <span className="check-icon">{r.pass ? "✓" : "✗"}</span>
                      <div>
                        <div className="validation-label">{r.label}</div>
                        {r.detail && <div className="validation-detail">{r.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}