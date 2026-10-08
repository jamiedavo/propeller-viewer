import React from "react";

/**
 * Small drawing of one blade (oblique view) so the two patent cases can be
 * compared by eye. Uses the same maths as the 3D model:
 *   x = r cos b cos a,  y = r cos b sin a,  z = r sin b,   a = n * b
 */
export default function ProfileThumb({ n, size = 92 }) {
  const az = (40 * Math.PI) / 180;
  const tilt = (24 * Math.PI) / 180;
  const proj = (r, bDeg) => {
    const b = (bDeg * Math.PI) / 180;
    const a = n * b;
    const x = r * Math.cos(b) * Math.cos(a);
    const y = r * Math.cos(b) * Math.sin(a);
    const z = r * Math.sin(b);
    const x1 = x * Math.cos(az) - y * Math.sin(az);
    const y1 = x * Math.sin(az) + y * Math.cos(az);
    return [x1, -(z * Math.cos(tilt) + y1 * Math.sin(tilt))];
  };
  const tip = [];
  for (let b = -90; b <= 90; b += 3) tip.push(proj(1, b));
  const pts = tip.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");
  const o = proj(0, 0);
  const rays = [];
  for (let b = -90; b <= 90; b += 9) {
    const [x, y] = proj(1, b);
    rays.push(<line key={b} x1={o[0]} y1={o[1]} x2={x} y2={y} strokeWidth="0.012" opacity="0.35" />);
  }
  return (
    <svg viewBox="-1.15 -1.15 2.3 2.3" width={size} height={size} stroke="currentColor" fill="none" aria-hidden="true">
      <polygon points={`${o[0]},${o[1]} ${pts}`} fill="currentColor" fillOpacity="0.12" stroke="none" />
      {rays}
      <polyline points={pts} strokeWidth="0.04" strokeLinejoin="round" />
      <line x1="0" y1="-1.1" x2="0" y2="1.1" strokeWidth="0.015" strokeDasharray="0.05 0.05" opacity="0.5" />
    </svg>
  );
}
