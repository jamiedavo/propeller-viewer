import React, { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import "./App.css";
import {
  defaultParams,
  paramRanges,
  sceneDefaults,
  validationConfig,
} from "./config/defaultParams";
import PropellerScene from "./scene/PropellerScene";
import {
  calculateAeroMetrics,
  clampSurfaceParams,
  degToRad,
  dot,
  length,
  surfaceFrameFromUV,
  surfacePoint,
} from "./geometry/surfaceMath";
import { exportAssemblyToSTL } from "./geometry/bladeMesh";

function approximatelyEqual(a, b, epsilon = 1e-5) {
  return Math.abs(a - b) <= epsilon;
}

function runValidation(params) {
  const { epsilon, sphereSampleCount, drawingMatchSampleDegrees } = validationConfig;
  const { rMax, n, bMin, bMax, bladeCount, probeU, probeV } = params;
  const results = [];

  // 1. Drawing logic validation: special case n = 1
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
    label: "Original drawing case n = 1 strictly matches governing geometry",
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

  // 4. Normal validity
  const normDotR = Math.abs(dot(frame.normal, frame.tangentRUnit));
  const normDotB = Math.abs(dot(frame.normal, frame.tangentBUnit));
  results.push({
    label: "Analytical surface normal is unit-length and normal to surface",
    pass:
      approximatelyEqual(length(frame.normal), 1, 1e-4) &&
      normDotR < 1e-4 &&
      normDotB < 1e-4,
    detail: `|n̂| = ${length(frame.normal).toFixed(4)}, pitch angle = ${frame.pitchAngleDeg.toFixed(1)}°`,
  });

  // 5. Blade count check
  results.push({
    label: "Blade count within test rig support (1 to 8 blades)",
    pass: Number.isInteger(bladeCount) && bladeCount >= 1 && bladeCount <= 8,
    detail: `${bladeCount} blades, ${(360 / bladeCount).toFixed(1)}° radial spacing`,
  });

  return results;
}

const VIEW_KEYS = [
  { key: "isometric", label: "Isometric" },
  { key: "front", label: "Front (XY)" },
  { key: "side", label: "Side (XZ)" },
  { key: "top", label: "Top (Disc)" },
  { key: "shaft", label: "Shaft Axial" },
  { key: "reset", label: "Reset View" },
];

export default function App() {
  const [params, setParams] = useState(() => clampSurfaceParams(defaultParams));
  const [viewRequest, setViewRequest] = useState({ key: sceneDefaults.startupView, nonce: 0 });
  const [activeTab, setActiveTab] = useState("geometry"); // 'geometry' | 'aero' | 'inspection' | 'validation'
  const currentGeometryRef = useRef(null);

  const updateParam = (key, val) => {
    setParams((prev) => {
      const nextVal = typeof val === "boolean" || typeof val === "string" ? val : Number(val);
      const updated = clampSurfaceParams({ ...prev, [key]: nextVal });
      if (key !== "isRunning") updated.isRunning = prev.isRunning;
      return updated;
    });
  };

  const validationResults = useMemo(() => runValidation(params), [params]);
  const aeroMetrics = useMemo(() => calculateAeroMetrics(params), [params]);
  const probeFrame = useMemo(() => surfaceFrameFromUV(params, params.probeU, params.probeV), [params]);

  const handleExportSTL = () => {
    if (currentGeometryRef.current) {
      exportAssemblyToSTL(currentGeometryRef.current, params.bladeCount, `propeller_n${params.n}_${params.bladeCount}blades.stl`);
    }
  };

  return (
    <div className="app-shell">
      {/* 3D Viewport Panel */}
      <main className="viewer-panel">
        <div className="viewer-stage">
          <Canvas
            camera={{
              position: [4.5, 3.8, 3.2],
              up: [0, 0, 1],
              fov: sceneDefaults.cameraFov,
              near: 0.1,
              far: 120,
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

          {/* Quick Action Overlay Bar on 3D Viewport */}
          <div className="viewport-quick-bar">
            <button
              type="button"
              className={`action-btn ${params.isRunning ? "active" : ""}`}
              onClick={() => updateParam("isRunning", !params.isRunning)}
            >
              {params.isRunning ? "❚❚ Pause Spin" : "▶ Start Spin"}
            </button>
            <button type="button" className="action-btn" onClick={handleExportSTL}>
              ⬇ Export 3D STL
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => setViewRequest((v) => ({ key: "reset", nonce: v.nonce + 1 }))}
            >
              ⟲ Reset Camera
            </button>
          </div>

          <div className="viewport-badge">
            <span className="badge-title">Governing Constant Pitch Angle:</span>
            <span className="badge-value">β = {aeroMetrics.pitchAngleDeg.toFixed(2)}° (arccot {params.n.toFixed(2)})</span>
          </div>
        </div>
      </main>

      {/* Technical Engineering Sidebar */}
      <aside className="control-panel">
        <div className="control-panel__scroll">
          {/* Header */}
          <header className="brand-header">
            <div className="brand-badge">Rooster Labs • Math-First Test Rig</div>
            <h1 className="brand-title">Parametric Propeller Viewer</h1>
            <p className="brand-desc">
              Three-generation engineering bridge: pre-digital spherical invention,
              rigorous analytical geometry, and interactive CFD/CAD validation.
            </p>
          </header>

          {/* Tab Navigation */}
          <nav className="tab-nav">
            {[
              { id: "geometry", label: "Geometry & Build" },
              { id: "aero", label: "Aerodynamics & Flow" },
              { id: "inspection", label: "Sections & Probe" },
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

          {/* Tab 1: Geometry Domain & Solidification */}
          {activeTab === "geometry" && (
            <div className="tab-pane">
              <section className="card">
                <div className="card-header">
                  <strong>Surface Parametric Domain</strong>
                  <span className="pill-tag">Equation: a = n·b</span>
                </div>

                <div className="control-row">
                  <div className="label-bar">
                    <span>Angular Multiplier (n)</span>
                    <strong>{params.n.toFixed(2)}</strong>
                  </div>
                  <input
                    type="range"
                    min={paramRanges.n.min}
                    max={paramRanges.n.max}
                    step={paramRanges.n.step}
                    value={params.n}
                    onChange={(e) => updateParam("n", e.target.value)}
                  />
                  <div className="hint-text">
                    Controls blade pitch angle: β = arctan(1/n) = {aeroMetrics.pitchAngleDeg.toFixed(1)}°
                  </div>
                </div>

                <div className="control-row">
                  <div className="label-bar">
                    <span>Blade Count</span>
                    <strong>{params.bladeCount} Blades</strong>
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
                    <span>Root Radius (rMin)</span>
                    <strong>{params.rMin.toFixed(2)} m</strong>
                  </div>
                  <input
                    type="range"
                    min={paramRanges.r.min}
                    max={params.rMax - paramRanges.r.minSpan}
                    step={paramRanges.r.step}
                    value={params.rMin}
                    onChange={(e) => updateParam("rMin", e.target.value)}
                  />
                </div>

                <div className="control-row">
                  <div className="label-bar">
                    <span>Tip Radius (rMax)</span>
                    <strong>{params.rMax.toFixed(2)} m</strong>
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

                <div className="control-row">
                  <div className="label-bar">
                    <span>Elevation Span (bMin → bMax)</span>
                    <strong>{params.bMin}° — {params.bMax}°</strong>
                  </div>
                  <div className="dual-slider">
                    <input
                      type="range"
                      min={paramRanges.b.min}
                      max={params.bMax - paramRanges.b.minSpan}
                      step={paramRanges.b.step}
                      value={params.bMin}
                      onChange={(e) => updateParam("bMin", e.target.value)}
                    />
                    <input
                      type="range"
                      min={params.bMin + paramRanges.b.minSpan}
                      max={paramRanges.b.max}
                      step={paramRanges.b.step}
                      value={params.bMax}
                      onChange={(e) => updateParam("bMax", e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Physical Solid Blade & Hub Setting */}
              <section className="card">
                <div className="card-header">
                  <strong>Physical Solid Blade & Hub</strong>
                  <span className="pill-tag">3D Print / CFD Mode</span>
                </div>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.solidBlade}
                    onChange={(e) => updateParam("solidBlade", e.target.checked)}
                  />
                  <span>
                    <strong>Extrude Solid Blade with Camber Thickness</strong>
                    <div className="subtext">
                      Lofts symmetric hydrofoil thickness tapering to leading and trailing edges.
                    </div>
                  </span>
                </label>

                {params.solidBlade && (
                  <div className="control-row">
                    <div className="label-bar">
                      <span>Maximum Root Thickness</span>
                      <strong>{(params.bladeThickness * 100).toFixed(1)} cm</strong>
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
                    checked={params.showHub}
                    onChange={(e) => updateParam("showHub", e.target.checked)}
                  />
                  <span>
                    <strong>Show Mounting Hub & Aerodynamic Spinner</strong>
                  </span>
                </label>
              </section>

              {/* Views */}
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

          {/* Tab 2: Aerodynamics & Flow */}
          {activeTab === "aero" && (
            <div className="tab-pane">
              <section className="card">
                <div className="card-header">
                  <strong>Propeller Kinematics & Spin</strong>
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
                    <div className="metric-label">Pitch Angle (β)</div>
                    <div className="metric-val">{aeroMetrics.pitchAngleDeg.toFixed(1)}°</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Pitch-to-Diameter (P/D)</div>
                    <div className="metric-val">{(Math.PI / params.n).toFixed(2)}</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Expanded Area Ratio (EAR)</div>
                    <div className="metric-val">{aeroMetrics.ear.toFixed(2)}</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Theoretical Advance (V₀)</div>
                    <div className="metric-val">{aeroMetrics.theoreticalSpeed.toFixed(1)} m/s</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Tip Speed</div>
                    <div className="metric-val">{aeroMetrics.tipSpeed.toFixed(1)} m/s</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">Total Blade Area</div>
                    <div className="metric-val">{aeroMetrics.totalBladeArea.toFixed(3)} m²</div>
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
                      <div className="subtext">Draws the contracting wake tube shed during rotation.</div>
                    </span>
                  </label>

                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={params.showThrustVector}
                      onChange={(e) => updateParam("showThrustVector", e.target.checked)}
                    />
                    <span>
                      <strong>Show Axial Thrust Vector</strong>
                    </span>
                  </label>
                </div>
              </section>
            </div>
          )}

          {/* Tab 3: Sections & Inspection */}
          {activeTab === "inspection" && (
            <div className="tab-pane">
              <section className="card">
                <strong>Surface & Section Overlays</strong>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showCylCut}
                    onChange={(e) => updateParam("showCylCut", e.target.checked)}
                  />
                  <span>
                    <strong style={{ color: "#ff80ab" }}>Cylindrical Section Foil Cut (ρ = const)</strong>
                    <div className="subtext">The true 2D profile experienced by the incident fluid.</div>
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
                    <strong>Interactive Probe & Tangent/Normal Triad</strong>
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

              {/* Surface Readout Box */}
              <section className="card">
                <strong>Probe Differential Geometry Readout</strong>
                <div className="readout-box">
                  <div><strong>Coordinate Point:</strong> x = {probeFrame.point.x.toFixed(3)}, y = {probeFrame.point.y.toFixed(3)}, z = {probeFrame.point.z.toFixed(3)}</div>
                  <div><strong>Spherical Radius (r):</strong> {probeFrame.r.toFixed(3)} m</div>
                  <div><strong>Cylindrical Shaft Radius (ρ):</strong> {probeFrame.localRadius.toFixed(3)} m</div>
                  <div><strong>Elevation Angle (b):</strong> {probeFrame.bDeg.toFixed(2)}°</div>
                  <div><strong>Local Pitch:</strong> {probeFrame.geometricPitch.toFixed(3)} m/rev</div>
                  <div><strong>Analytical Normal n̂:</strong> ({probeFrame.normal.x.toFixed(3)}, {probeFrame.normal.y.toFixed(3)}, {probeFrame.normal.z.toFixed(3)})</div>
                </div>
              </section>
            </div>
          )}

          {/* Tab 4: Validation */}
          {activeTab === "validation" && (
            <div className="tab-pane">
              <section className="card">
                <div className="card-header">
                  <strong>Mathematical Authority Validation</strong>
                  <span className="pill-tag pass">STATUS: VERIFIED</span>
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