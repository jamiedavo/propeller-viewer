# README_APP_CONTEXT

## Purpose
This project is an interactive 3D technical viewer for exploring a mathematically defined ruled spherical surface ($x = r \cos(b) \cos(nb)$, $y = r \cos(b) \sin(nb)$, $z = r \sin(b)$) in the browser.

## Current App State
**Stage 6 — Technical Inspection & Solidification Rig**

Features included:
- Parametric domain controls ($r_{\min}, r_{\max}, b_{\min}, b_{\max}, n$)
- Multi-blade assembly rendering (1 to 8 blades)
- Watertight 2-manifold solid blade extrusion with realistic 30% chord foil thickness
- 3D-printable solid STL and CAD sheet STL exporter
- Slipstream flow ribbons reversing dynamically with shaft RPM
- Shaft-aligned thrust vector
- Clearance-verified hub and spinner geometry
- Interactive probe with exact differential geometry readout
- Cylindrical section cuts ($\rho = \text{const}$) illustrating progressive chordwise pitch
- Quantitative validation panel verifying orthogonality, analytical cylindrical pitch, and hub clearance

## Governing Mathematics
- `x = r * cos(b) * cos(n * b)`
- `y = r * cos(b) * sin(n * b)`
- `z = r * sin(b)`

Where:
- `r` is the radial distance from the origin
- `b` is the elevation angle from the XY-plane
- `n` is the angular multiplier ($a = n \cdot b$)

Cylindrical section pitch angle:
$$\tan(\beta_{\text{cyl}}) = \frac{1}{n \cos^2(b)}$$
Geometric pitch:
$$P_{\text{cyl}} = \frac{2\pi r}{n \cos(b)}$$