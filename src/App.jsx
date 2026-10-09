import React, { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import "./App.css";
import {
  defaultParams,
  paramRanges,
  sceneDefaults,
  patentProfiles,
} from "./config/defaultParams";
import ProfileThumb from "./components/ProfileThumb";
import PropellerScene from "./scene/PropellerScene";
import {
  calculateAeroMetrics,
  clampSurfaceParams,
  surfaceFrameFromUV,
} from "./geometry/surfaceMath";
import { exportAssemblyToSTL } from "./geometry/bladeMesh";

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
  const [activeTab, setActiveTab] = useState("design");
  const currentGeometryRef = useRef(null);

  const updateParam = (key, val) => {
    setParams((prev) => {
      const nextVal = typeof val === "boolean" || typeof val === "string" ? val : Number(val);
      const extra = key === "profile" ? { n: patentProfiles.find((p) => p.key === val)?.n ?? prev.n } : {};
      // Keep the inner cut-off (centre hole) proportional to the tip radius when
      // the Size slider changes, so shrinking the propeller doesn't leave a big hole.
      const scaled =
        key === "rMax" && prev.rMax > 0
          ? { rMin: prev.rMin * (nextVal / prev.rMax) }
          : {};
      const updated = clampSurfaceParams({ ...prev, [key]: nextVal, ...extra, ...scaled });
      if (key !== "isRunning") updated.isRunning = prev.isRunning;
      return updated;
    });
  };

  const aeroMetrics = useMemo(() => calculateAeroMetrics(params), [params]);
  const probeFrame = useMemo(() => surfaceFrameFromUV(params, params.probeU, params.probeV), [params]);

  const handleExportSTL = async () => {
    if (currentGeometryRef.current) {
      const modeName = params.solidBlade ? "solid" : "sheet_open";
      await exportAssemblyToSTL(
        currentGeometryRef.current,
        params.bladeCount,
        params.showShaft ? { radius: (params.rMax * params.shaftRatio) / 2, length: params.rMax * 2 } : null,
        `propeller_${params.profile}_${params.bladeCount}blades_${modeName}.stl`,
        { solid: params.solidBlade }
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
            <div className="spin-control-group">
              <button
                type="button"
                className={`action-btn ${params.isRunning ? "active" : ""}`}
                onClick={() => updateParam("isRunning", !params.isRunning)}
              >
                {params.isRunning ? "❚❚ Pause Spin" : "▶ Start Spin"}
              </button>
              <label className="rpm-control">
                <span>RPM</span>
                <input
                  type="range"
                  min={paramRanges.rpm.min}
                  max={paramRanges.rpm.max}
                  step={paramRanges.rpm.step}
                  value={params.rpm}
                  aria-label="Shaft speed in revolutions per minute"
                  onChange={(e) => updateParam("rpm", e.target.value)}
                />
                <strong>{params.rpm}</strong>
              </label>
            </div>
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
            <div className="brand-badge">Davidson Propulsion Labs</div>
            <h1 className="brand-title">Parametric Propeller Viewer</h1>
          </header>

          {/* Navigation Tabs */}
          <nav className="tab-nav">
            {[
              { id: "design", label: "Design" },
              { id: "inspect", label: "Inspect" },
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

          {/* DESIGN TAB */}
          {activeTab === "design" && (
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
                    <small style={{ display: "block", opacity: 0.7, marginTop: 2 }}>Straight rod on the axis that joins the blades. Included in the STL export. Recommended for 3D printing: it fuses the blades into one solid.</small>
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

              <section className="card">
                <details>
                  <summary className="section-summary">Geometric estimates</summary>
                  <div className="metric-grid">
                    <div className="metric-box">
                      <div className="metric-label">Minimum Pitch Angle</div>
                      <div className="metric-val">{aeroMetrics.minPitchAngleDeg.toFixed(1)}°</div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Maximum Pitch Angle</div>
                      <div className="metric-val">{aeroMetrics.maxPitchAngleDeg.toFixed(1)}°</div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Area Ratio Estimate</div>
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
                      <div className="metric-label">Ideal Pitch Speed (Zero Slip)</div>
                      <div className="metric-val">{aeroMetrics.theoreticalSpeedMean.toFixed(1)} m/s</div>
                    </div>
                  </div>
                  <p className="hint-text">
                    Geometry-derived estimates only; pitch speed assumes zero slip and is not a thrust or performance prediction.
                  </p>
                </details>
              </section>
            </div>
          )}

          {/* INSPECT TAB */}
          {activeTab === "inspect" && (
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
                    <strong style={{ color: "#ff80ab" }}>Cylindrical section overlay (ρ = const)</strong>
                  </span>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showIsoR}
                    onChange={(e) => updateParam("showIsoR", e.target.checked)}
                  />
                  <span>
                    <strong style={{ color: "#ffe082" }}>Constant-radius overlay (r = const)</strong>
                  </span>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showIsoB}
                    onChange={(e) => updateParam("showIsoB", e.target.checked)}
                  />
                  <span>
                    <strong style={{ color: "#80deea" }}>Constant-elevation overlay (b = const)</strong>
                  </span>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showProbe}
                    onChange={(e) => updateParam("showProbe", e.target.checked)}
                  />
                  <span>
                    <strong>Show probe marker and local frame</strong>
                  </span>
                </label>

                <div style={{ marginTop: 12 }}>
                  <div className="control-row">
                    <div className="label-bar">
                      <span>Radial station (r)</span>
                      <strong>{formatRadius(probeFrame.r)}</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={params.probeU}
                      aria-label="Probe radius station"
                      onChange={(e) => updateParam("probeU", e.target.value)}
                    />
                  </div>

                  <div className="control-row">
                    <div className="label-bar">
                      <span>Elevation station (b)</span>
                      <strong>{probeFrame.bDeg.toFixed(1)}°</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={params.probeV}
                      aria-label="Probe elevation station"
                      onChange={(e) => updateParam("probeV", e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="card">
                <strong>Readout at selected station</strong>
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

              <section className="card">
                <strong>Illustrative motion overlays</strong>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showFlow}
                    onChange={(e) => updateParam("showFlow", e.target.checked)}
                  />
                  <span><strong>Show illustrative helical lines</strong></span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={params.showThrustVector}
                    onChange={(e) => updateParam("showThrustVector", e.target.checked)}
                  />
                  <span><strong>Show rotation-direction arrow</strong></span>
                </label>
                <p className="hint-text">Visible while the propeller is spinning; these do not represent computed airflow or thrust.</p>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}