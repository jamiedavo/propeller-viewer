import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
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
      <strong style={{ display: "block", marginBottom: 12 }}>{title}</strong>
      {children}
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
        <span style={{ display: "block", fontSize: 13 }}>{label}</span>
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
        <strong style={{ fontSize: 14 }}>Validation</strong>
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
              <span style={{ fontSize: 13 }}>{result.label}</span>
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

  const validationResults = useMemo(() => runValidation(params), [params]);
  const probeFrame = useMemo(() => {
    return surfaceFrameFromUV(params, params.probeU, params.probeV);
  }, [params]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "360px 1fr",
        height: "100vh",
        width: "100vw",
        background: "#0b0d12",
        color: "#eef2f7",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <aside
        style={{
          padding: 18,
          borderRight: "1px solid #1d2230",
          overflowY: "auto",
          background: "#0f1219",
        }}
      >
        <h1 style={{ fontSize: 20, margin: "0 0 6px 0" }}>
          Stage 5 — Parametric Domain + Surface Inspection
        </h1>

        <p
          style={{
            margin: "0 0 18px 0",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#b7c0d0",
          }}
        >
          The blade remains the exact sampled surface defined by the original
          parametric equations, but the radial span and angular window are now
          editable. A probe overlay exposes a live point, local tangents, and
          surface normal on blade 1.
        </p>

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
              angular speed: <strong>{rpmToRadPerSec(params.rpm).toFixed(3)} rad/s</strong>
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
      </aside>

      <main style={{ position: "relative" }}>
        <Canvas camera={{ position: [4.4, 3.4, 5.2], fov: 50, near: 0.1, far: 100 }}>
          <PropellerScene params={params} />
        </Canvas>

        <div
          style={{
            position: "absolute",
            right: 16,
            top: 16,
            background: "rgba(12,14,20,0.82)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            color: "#d6dce8",
            lineHeight: 1.5,
            pointerEvents: "none",
          }}
        >
          <div>
            <strong>Stage 5 viewport</strong>
          </div>
          <div>Unlocked radial and angular surface domain</div>
          <div>Two identical blades rotated 180° about z</div>
          <div>
            Domain: r {params.rMin.toFixed(2)} → {params.rMax.toFixed(2)}, b {params.bMin.toFixed(0)}° → {params.bMax.toFixed(0)}°
          </div>
          <div>
            Probe: r {probeFrame.r.toFixed(2)}, b {probeFrame.bDeg.toFixed(1)}°
          </div>
          <div>{params.isRunning ? `Running at ${params.rpm.toFixed(0)} rpm` : "Stopped"}</div>
        </div>
      </main>
    </div>
  );
}