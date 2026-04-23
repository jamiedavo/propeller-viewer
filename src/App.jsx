import React, { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import "./App.css";
import {
  defaultParams,
  paramRanges,
  validationConfig,
} from "./config/defaultParams";
import PropellerScene from "./scene/PropellerScene";
import {
  clamp,
  clampSurfaceParams,
  degToRad,
  dot,
  length,
  surfaceFrameFromUV,
  surfacePoint,
} from "./geometry/surfaceMath";

function approximatelyEqual(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
}

function pointApproximatelyEqual(p1, p2, epsilon = 1e-6) {
  return (
    approximatelyEqual(p1.x, p2.x, epsilon) &&
    approximatelyEqual(p1.y, p2.y, epsilon) &&
    approximatelyEqual(p1.z, p2.z, epsilon)
  );
}

function hexColorIsValid(value) {
  return /^#([0-9A-Fa-f]{6})$/.test(value);
}

function rpmToRadPerSec(rpm) {
  return (rpm * Math.PI * 2) / 60;
}

function runValidation(params) {
  const { epsilon, sphereSampleCount, drawingMatchSampleDegrees } =
    validationConfig;

  const {
    rMin,
    rMax,
    n,
    bMin,
    bMax,
    gridOpacity,
    blade1Color,
    blade2Color,
    rpm,
    isRunning,
    probeU,
    probeV,
  } = params;

  const results = [];

  let drawingLogicPass = true;

  for (const bDeg of drawingMatchSampleDegrees) {
    const b = degToRad(bDeg);
    const actual = surfacePoint(rMax, b, 1);
    const expected = {
      x: rMax * Math.cos(b) * Math.cos(b),
      y: rMax * Math.sin(b) * Math.cos(b),
      z: rMax * Math.sin(b),
    };

    if (!pointApproximatelyEqual(actual, expected, epsilon)) {
      drawingLogicPass = false;
      break;
    }
  }

  results.push({
    label: "Special case n = 1 still matches the original drawing logic",
    pass: drawingLogicPass,
  });

  results.push({
    label: "Radial domain is valid and ordered",
    pass:
      rMin >= paramRanges.r.min &&
      rMax <= paramRanges.r.max &&
      rMax - rMin >= paramRanges.r.minSpan,
    detail: `rMin = ${rMin.toFixed(2)}, rMax = ${rMax.toFixed(2)}`,
  });

  results.push({
    label: "Angular domain is valid and ordered",
    pass:
      bMin >= paramRanges.b.min &&
      bMax <= paramRanges.b.max &&
      bMax - bMin >= paramRanges.b.minSpan,
    detail: `bMin = ${bMin.toFixed(1)}°, bMax = ${bMax.toFixed(1)}°`,
  });

  let spherePass = true;
  let maxSphereError = 0;

  for (let i = 0; i <= sphereSampleCount; i += 1) {
    const t = i / sphereSampleCount;
    const bDeg = bMin + (bMax - bMin) * t;
    const b = degToRad(bDeg);
    const p = surfacePoint(rMax, b, n);
    const lhs = p.x * p.x + p.y * p.y + p.z * p.z;
    const rhs = rMax * rMax;
    const error = Math.abs(lhs - rhs);

    maxSphereError = Math.max(maxSphereError, error);

    if (!approximatelyEqual(lhs, rhs, 1e-5)) {
      spherePass = false;
    }
  }

  results.push({
    label: "Outer curve still satisfies x² + y² + z² = r²",
    pass: spherePass,
    detail: `max error = ${maxSphereError.toExponential(3)}`,
  });

  const probeFrame = surfaceFrameFromUV(params, probeU, probeV);
  const orthogonality = Math.abs(dot(probeFrame.normal, probeFrame.tangentRUnit));
  const orthogonalityB = Math.abs(dot(probeFrame.normal, probeFrame.tangentBUnit));
  const probeFinite = [
    probeFrame.point.x,
    probeFrame.point.y,
    probeFrame.point.z,
    probeFrame.normal.x,
    probeFrame.normal.y,
    probeFrame.normal.z,
  ].every(Number.isFinite);

  results.push({
    label: "Probe frame returns a finite point, tangents, and normal",
    pass:
      probeFinite &&
      approximatelyEqual(length(probeFrame.normal), 1, 1e-5) &&
      orthogonality < 1e-5 &&
      orthogonalityB < 1e-5,
    detail: `probe r = ${probeFrame.r.toFixed(2)}, b = ${probeFrame.bDeg.toFixed(
      1
    )}°, ρ = ${probeFrame.localRadius.toFixed(3)}`,
  });

  results.push({
    label: "Grid opacity is within valid range",
    pass:
      gridOpacity >= paramRanges.gridOpacity.min &&
      gridOpacity <= paramRanges.gridOpacity.max,
    detail: `grid = ${gridOpacity.toFixed(2)}`,
  });

  results.push({
    label: "Blade colors are valid hex values",
    pass: hexColorIsValid(blade1Color) && hexColorIsValid(blade2Color),
    detail: `blade 1 = ${blade1Color}, blade 2 = ${blade2Color}`,
  });

  results.push({
    label: "RPM is within valid range: 0 to 300",
    pass: rpm >= paramRanges.rpm.min && rpm <= paramRanges.rpm.max,
    detail: `rpm = ${rpm.toFixed(1)}, ω = ${rpmToRadPerSec(rpm).toFixed(3)} rad/s`,
  });

  results.push({
    label: "Start/stop state is valid",
    pass: typeof isRunning === "boolean",
    detail: `assembly is ${isRunning ? "running" : "stopped"}`,
  });

  return results;
}

function Card({ title, children }) {
  return (
    <div
      style={{
        background: "#171a21",
        border: "1px solid #2a3040",
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
      }}
    >
      <strong style={{ display: "block", marginBottom: 12, color: "#f3f6fb" }}>
        {title}
      </strong>
      {children}
    </div>
  );
}

function ProjectHeader({ compact = false }) {
  return (
    <div
      style={{
        marginBottom: 18,
        padding: compact ? 16 : 18,
        borderRadius: 14,
        border: "1px solid #2a3040",
        background:
          "linear-gradient(180deg, rgba(24,30,42,0.96) 0%, rgba(14,18,26,0.98) 100%)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#8fa7cf",
          marginBottom: 10,
        }}
      >
        Rooster Labs
      </div>

      <h1
        style={{
          margin: "0 0 10px 0",
          fontSize: compact ? 24 : 28,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: "#f7f9fc",
        }}
      >
        Parametric Propeller Viewer
      </h1>

      <p
        style={{
          margin: 0,
          fontSize: compact ? 14 : 15,
          lineHeight: 1.6,
          color: "#d9e1ec",
        }}
      >
        Rooster Labs brings together legacy invention, enduring mathematical
        insight, and modern interactive 3D tools across three generations to
        bring a pre-digital propeller concept back to life.
      </p>
    </div>
  );
}

function ControlRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v,
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          fontSize: 13,
          color: "#eef2f7",
        }}
      >
        <span>{label}</span>
        <strong>{format(value)}</strong>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}

function PropFormControl({ value, onSliderChange, onInputChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          fontSize: 13,
          color: "#eef2f7",
        }}
      >
        <span>Angular multiplier (n)</span>
        <strong>{value.toFixed(2)}</strong>
      </div>

      <input
        type="range"
        min={paramRanges.n.min}
        max={paramRanges.n.max}
        step={paramRanges.n.step}
        value={value}
        onChange={(e) => onSliderChange(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <input
        type="number"
        min={paramRanges.n.min}
        max={paramRanges.n.max}
        step={paramRanges.n.step}
        value={value}
        onChange={(e) => onInputChange(e.target.value)}
        style={{
          width: "100%",
          height: 38,
          border: "1px solid #2a3040",
          borderRadius: 8,
          background: "#11141a",
          color: "#eef2f7",
          padding: "0 10px",
          fontSize: 14,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          fontSize: 13,
          color: "#eef2f7",
        }}
      >
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 36,
          border: "1px solid #2a3040",
          borderRadius: 6,
          background: "#11141a",
          padding: 2,
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function CheckboxRow({ label, checked, onChange, hint }) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr",
        gap: 10,
        alignItems: "start",
        marginBottom: 12,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2 }}
      />
      <span>
        <span style={{ display: "block", fontSize: 13, color: "#eef2f7" }}>
          {label}
        </span>
        {hint && (
          <span style={{ display: "block", fontSize: 12, color: "#aab3c2" }}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

function ToggleButton({ isRunning, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%",
        height: 40,
        borderRadius: 8,
        border: "1px solid #2a3040",
        background: isRunning ? "#22412d" : "#1a2230",
        color: "#eef2f7",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {isRunning ? "Stop" : "Start"}
    </button>
  );
}

const VIEW_OPTIONS = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "side", label: "Side" },
  { key: "isometric", label: "Isometric" },
  { key: "shaft", label: "Shaft" },
  { key: "reset", label: "Reset" },
];

function ViewButton({ label, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 36,
        borderRadius: 8,
        border: `1px solid ${isActive ? "#5f87b8" : "#2a3040"}`,
        background: isActive ? "#1d2c41" : "#11141a",
        color: "#eef2f7",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

function ViewsPanel({ activeViewKey, onSelect }) {
  return (
    <Card title="Views">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {VIEW_OPTIONS.map((view) => (
          <ViewButton
            key={view.key}
            label={view.label}
            isActive={activeViewKey === view.key}
            onClick={() => onSelect(view.key)}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 12,
          lineHeight: 1.5,
          color: "#9fabc0",
        }}
      >
        Preset camera snaps around the propeller center. Axial views follow the
        z-axis shaft.
      </div>
    </Card>
  );
}

function ValidationPanel({ results }) {
  const allPass = results.every((r) => r.pass);

  return (
    <div
      style={{
        background: "#171a21",
        border: "1px solid #2a3040",
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <strong style={{ fontSize: 14, color: "#f3f6fb" }}>Validation</strong>
        <span
          style={{
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 999,
            background: allPass ? "#16351f" : "#442222",
            color: allPass ? "#8ef0a7" : "#ff9b9b",
            border: `1px solid ${allPass ? "#255b35" : "#6b2c2c"}`,
          }}
        >
          {allPass ? "PASS" : "CHECK REQUIRED"}
        </span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {results.map((result, index) => (
          <div
            key={`${result.label}-${index}`}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: "#11141a",
              border: "1px solid #222938",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  width: 18,
                  display: "inline-block",
                  textAlign: "center",
                  color: result.pass ? "#77e08a" : "#ff8f8f",
                }}
              >
                {result.pass ? "✓" : "✗"}
              </span>
              <span style={{ fontSize: 13, color: "#e8edf5" }}>{result.label}</span>
            </div>

            {result.detail && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "#aab3c2",
                  paddingLeft: 26,
                }}
              >
                {result.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProbeReadout({ frame }) {
  return (
    <Card title="Surface readout">
      <div style={{ display: "grid", gap: 8, fontSize: 12, color: "#d6dce8" }}>
        <div>
          <strong>Probe parameters</strong>
          <div>r = {frame.r.toFixed(3)}</div>
          <div>b = {frame.bDeg.toFixed(2)}°</div>
          <div>radius from z-axis = {frame.localRadius.toFixed(3)}</div>
        </div>

        <div>
          <strong>Point position</strong>
          <div>x = {frame.point.x.toFixed(3)}</div>
          <div>y = {frame.point.y.toFixed(3)}</div>
          <div>z = {frame.point.z.toFixed(3)}</div>
        </div>

        <div>
          <strong>Local frame</strong>
          <div>
            |∂S/∂r| = {length(frame.tangentR).toFixed(3)} | |∂S/∂b| = {length(
              frame.tangentB
            ).toFixed(3)}
          </div>
          <div>
            n̂ = ({frame.normal.x.toFixed(3)}, {frame.normal.y.toFixed(3)},{" "}
            {frame.normal.z.toFixed(3)})
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function App() {
  const [params, setParams] = useState(clampSurfaceParams(defaultParams));
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [viewRequest, setViewRequest] = useState({
    key: "reset",
    nonce: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobileLayout = viewportWidth < 900;

  const updateParam = (key, value) => {
    setParams((prev) => {
      const nextValue =
        key === "blade1Color" || key === "blade2Color" || typeof value === "boolean"
          ? value
          : Number(value);

      const nextParams = clampSurfaceParams({
        ...prev,
        [key]: nextValue,
      });

      if (typeof prev.isRunning === "boolean" && key !== "isRunning") {
        nextParams.isRunning = prev.isRunning;
      }

      return nextParams;
    });
  };

  const updateNFromInput = (rawValue) => {
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed)) {
      return;
    }

    updateParam("n", clamp(parsed, paramRanges.n.min, paramRanges.n.max));
  };

  const toggleRunning = () => {
    setParams((prev) => ({
      ...prev,
      isRunning: !prev.isRunning,
    }));
  };

  const requestView = (key) => {
    setViewRequest((prev) => ({
      key,
      nonce: prev.nonce + 1,
    }));
  };

  const validationResults = useMemo(() => runValidation(params), [params]);
  const probeFrame = useMemo(() => {
    return surfaceFrameFromUV(params, params.probeU, params.probeV);
  }, [params]);

  return (
    <div className="app-shell">
      <main className="viewer-panel">
        <div className="viewer-stage">
          <Canvas
            style={{ width: "100%", height: "100%" }}
            camera={{
              position: [0.0, 5.2, 0.0],
              up: [0, 0, 1],
              fov: 80,
              near: 0.1,
              far: 100,
            }}
          >
            <PropellerScene params={params} viewRequest={viewRequest} />
          </Canvas>
        </div>
      </main>

      <aside className="control-panel">
        <div className="control-panel__scroll">
          <ProjectHeader compact={isMobileLayout} />

          <Card title="Geometry domain">
            <PropFormControl
              value={params.n}
              onSliderChange={(value) => updateParam("n", value)}
              onInputChange={updateNFromInput}
            />

            <ControlRow
              label="Root radius (rMin)"
              value={params.rMin}
              min={paramRanges.r.min}
              max={paramRanges.r.max - paramRanges.r.minSpan}
              step={paramRanges.r.step}
              onChange={(value) => updateParam("rMin", value)}
              format={(v) => v.toFixed(2)}
            />

            <ControlRow
              label="Tip radius (rMax)"
              value={params.rMax}
              min={params.rMin + paramRanges.r.minSpan}
              max={paramRanges.r.max}
              step={paramRanges.r.step}
              onChange={(value) => updateParam("rMax", value)}
              format={(v) => v.toFixed(2)}
            />

            <ControlRow
              label="bMin"
              value={params.bMin}
              min={paramRanges.b.min}
              max={paramRanges.b.max - paramRanges.b.minSpan}
              step={paramRanges.b.step}
              onChange={(value) => updateParam("bMin", value)}
              format={(v) => `${v.toFixed(0)}°`}
            />

            <ControlRow
              label="bMax"
              value={params.bMax}
              min={params.bMin + paramRanges.b.minSpan}
              max={paramRanges.b.max}
              step={paramRanges.b.step}
              onChange={(value) => updateParam("bMax", value)}
              format={(v) => `${v.toFixed(0)}°`}
            />
          </Card>

          <ViewsPanel activeViewKey={viewRequest.key} onSelect={requestView} />

          <Card title="Appearance + motion">
            <ControlRow
              label="Grid opacity"
              value={params.gridOpacity}
              min={paramRanges.gridOpacity.min}
              max={paramRanges.gridOpacity.max}
              step={paramRanges.gridOpacity.step}
              onChange={(value) => updateParam("gridOpacity", value)}
              format={(v) => v.toFixed(2)}
            />

            <ColorRow
              label="Blade 1 color"
              value={params.blade1Color}
              onChange={(value) => updateParam("blade1Color", value)}
            />

            <ColorRow
              label="Blade 2 color"
              value={params.blade2Color}
              onChange={(value) => updateParam("blade2Color", value)}
            />

            <ControlRow
              label="RPM"
              value={params.rpm}
              min={paramRanges.rpm.min}
              max={paramRanges.rpm.max}
              step={paramRanges.rpm.step}
              onChange={(value) => updateParam("rpm", value)}
              format={(v) => `${v.toFixed(0)} rpm`}
            />

            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6, fontSize: 13, color: "#b7c0d0" }}>
                angular speed:{" "}
                <strong>{rpmToRadPerSec(params.rpm).toFixed(3)} rad/s</strong>
              </div>
              <ToggleButton isRunning={params.isRunning} onToggle={toggleRunning} />
            </div>
          </Card>

          <Card title="Surface inspection">
            <CheckboxRow
              label="Show probe"
              checked={params.showProbe}
              onChange={(value) => updateParam("showProbe", value)}
              hint="Probe is drawn on blade 1 and rotates with the assembly."
            />

            <CheckboxRow
              label="Show constant-r iso-curve"
              checked={params.showIsoR}
              onChange={(value) => updateParam("showIsoR", value)}
              hint="Highlights the current probe radius across the angular domain."
            />

            <CheckboxRow
              label="Show constant-b iso-line"
              checked={params.showIsoB}
              onChange={(value) => updateParam("showIsoB", value)}
              hint="Highlights the current probe angle across the radial span."
            />

            <ControlRow
              label="Probe radial position"
              value={params.probeU}
              min={paramRanges.probe.min}
              max={paramRanges.probe.max}
              step={paramRanges.probe.step}
              onChange={(value) => updateParam("probeU", value)}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />

            <ControlRow
              label="Probe angular position"
              value={params.probeV}
              min={paramRanges.probe.min}
              max={paramRanges.probe.max}
              step={paramRanges.probe.step}
              onChange={(value) => updateParam("probeV", value)}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />

            <ControlRow
              label="Probe vector scale"
              value={params.probeVectorScale}
              min={0.1}
              max={1.2}
              step={0.01}
              onChange={(value) => updateParam("probeVectorScale", value)}
              format={(v) => v.toFixed(2)}
            />
          </Card>

          <ProbeReadout frame={probeFrame} />
          <ValidationPanel results={validationResults} />
        </div>
      </aside>
    </div>
  );
}