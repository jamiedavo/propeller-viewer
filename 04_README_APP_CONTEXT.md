# README_APP_CONTEXT

## Purpose

This project is an interactive 3D propeller viewer for exploring a mathematically defined propeller-like surface in the browser.

It exists to make an inherited pre-digital propeller concept inspectable using current tools. The viewer is intended to support technical understanding, visual validation, and controlled iteration without losing sight of the original governing mathematics.

This is not primarily an artistic propeller model. It is a math-first technical viewer.

---

## Project identity

This app sits at the intersection of:

- legacy invention
- enduring mathematical insight
- modern interactive 3D tooling

The viewer should preserve that balance. It should feel disciplined, readable, and technically grounded.

---

## Current app state

The current build is positioned in the UI as:

**Stage 5 — Parametric Domain + Surface Inspection**

At this stage, the app already includes:

- editable radial domain
- editable angular domain
- editable angular multiplier `n`
- two-blade assembly rendering
- distinct blade colours
- grid opacity control
- RPM control and start/stop spin
- view preset buttons
- probe-based surface inspection
- constant-`r` and constant-`b` debug overlays
- validation checks against the governing math

---

## Role in the authority stack

This file is supporting implementation context.

It explains the app purpose, current build state, scene behaviour, file responsibilities, validation intent, rendering intent, and patch workflow expectations.

It does **not** override:

- `01_Source of Truth - Math Spec.md`
- `02_dads_equation.txt`
- `03_tech_drawing.png`

If this file conflicts with the governing source files, the governing source files win.

---

## Core mathematical source of truth

The governing surface is defined by:

- `x = r * cos(b) * cos(n * b)`
- `y = r * cos(b) * sin(n * b)`
- `z = r * sin(b)`

Where:

- `r` is the radial distance from the origin
- `b` is the elevation angle from the XY-plane
- `n` is the angular multiplier in the relationship `a = n * b`

UI angles are expressed in degrees, while trig calculations are handled internally in radians.

This mathematical relationship is the primary authority for the project.

If a rendered or edited result looks visually appealing but contradicts the governing equations, the equations win.

---

## Special-case drawing logic

A key validation case in the project is the original special case where `n = 1`.

That produces:

- `x = r * cos(b) * cos(b)`
- `y = r * sin(b) * cos(b)`
- `z = r * sin(b)`

The current app explicitly validates that this special case still matches the original drawing logic.

---

## What the app does

The viewer allows the user to:

- inspect a mathematically generated blade surface in 3D
- see a second identical blade rotated 180 degrees about the z-axis
- adjust the radial and angular domain of the surface
- change the angular multiplier `n`
- inspect local points and local surface frame information
- animate the full propeller assembly around the z-axis
- snap the camera to useful technical inspection views

The app should continue to support these workflows cleanly.

---

## Scene orientation

The scene is organised around the z-axis as the shaft / rotation axis.

Important orientation assumptions:

- the propeller rotates around the z-axis
- the propeller is centred on the origin
- the scene includes visible axes
- the scene includes a shaft reference
- the default technical feel should be preserved

This is an inspection environment, not a cinematic scene.

---

## Current camera / view behavior

The app currently includes these preset view buttons:

- Front
- Back
- Top
- Bottom
- Side
- Isometric
- Shaft
- Reset

These views are intended to orbit around the propeller centre and support technical reading of the form.

Camera changes should preserve:

- correct orbit target
- smooth view transitions where practical
- clean interaction with orbit controls after snapping
- stable inspection behaviour

---

## Current control groups

The current UI is organised around these main sections:

- Geometry domain
- Views
- Appearance + motion
- Surface inspection
- Surface readout
- Validation

That grouping is useful and should remain coherent unless there is a strong reason to restructure it.

---

## Rendering intent

The rendering style should prioritise clarity.

Current intent:

- solid readable blade surfaces
- distinct front/back blade colours
- technical rather than flashy presentation
- enough lighting to read form clearly
- overlays and debug aids that help inspection rather than clutter it

Avoid drifting toward decorative rendering choices that make the surface harder to interpret.

---

## Blade assembly logic

The project uses a two-blade rotating assembly.

Important logic:

- blade 2 is the same surface as blade 1
- blade 2 is rotated by `Math.PI` about the z-axis
- both blades should remain mathematically identical unless a future mode explicitly introduces asymmetry
- spin is applied at the assembly level, not by changing the underlying geometry

This separation matters and should be preserved.

---

## Surface inspection intent

A major part of this build is inspectability.

The current inspection model includes:

- a probe point driven by `(u, v)` over the surface domain
- readout of the probe’s `r` and `b`
- point position in 3D
- local radius from the z-axis
- local tangent and normal information
- optional constant-`r` and constant-`b` debug curves

These tools are not decorative. They are part of the technical purpose of the app.

---

## Validation intent

The app currently includes a validation panel that checks whether core assumptions remain true.

That is important.

Validation should continue to protect things like:

- original drawing compatibility at `n = 1`
- valid radial domain ordering
- valid angular domain ordering
- spherical consistency of the outer curve
- finite and well-formed local frame calculations
- valid colour values
- valid RPM range
- valid motion state

When editing the project, preserve or strengthen validation rather than removing it.

---

## Current stack

This project currently uses:

- Vite
- React
- React DOM
- @react-three/fiber
- @react-three/drei
- three

Linting and development are also set up through the existing Vite / ESLint structure.

---

## Core file responsibilities

### `package.json`
Defines the Vite/React project, scripts, and dependency stack.

### `src/App.jsx`
Main app shell and primary UI orchestration.

Responsible for:
- layout
- section structure
- control wiring
- validation execution
- surface readout display
- view selection requests
- canvas setup

This is usually the first file to inspect for UI, control flow, layout, and startup presentation changes.

### `src/config/defaultParams.js`
Holds user-facing defaults and ranges.

Responsible for:
- slider ranges
- default colours
- default domain values
- default probe settings
- default RPM
- validation config
- mesh segment config

This file is the main authority for startup settings.

### `src/geometry/surfaceMath.js`
Core mathematical utilities.

Responsible for:
- angle conversion
- clamping and interpolation helpers
- surface point generation
- surface derivatives
- local surface frame
- UV-to-domain mapping
- parameter sanitisation

This is a high-authority file and should remain tightly aligned with the source math.

### `src/geometry/bladeMesh.js`
Builds renderable blade surface data from the governing math.

Responsible for:
- sampled positions
- normals
- UVs
- indices
- mesh topology decisions

Changes here can easily alter the actual interpretation of the surface, so this file should be treated carefully.

### `src/scene/PropellerScene.jsx`
Main 3D scene composition.

Responsible for:
- scene background
- lights
- grid
- axes
- shaft reference
- orbit controls
- camera snap controller
- assembly placement in scene

This is the main file for camera/view behavior and scene readability.

### `src/scene/BladeAssembly.jsx`
Builds the full two-blade propeller assembly and applies spin.

Responsible for:
- shared blade geometry
- duplicate blade placement
- debug overlays
- probe placement
- assembly rotation through the spin hook

### `src/scene/BladeSurfaceMesh.jsx`
Rendering component for one blade.

Responsible for:
- blade material
- surface rendering
- shared geometry display
- boundary edge rendering for readability

### `src/hooks/usePropellerSpin.js`
Applies RPM-based assembly rotation around the z-axis.

This should remain separate from geometry generation.

### Supporting scene files
- `src/scene/DebugCurve.jsx`
- `src/scene/ProbePoint.jsx`
- `src/scene/SceneAxes.jsx`
- `src/scene/ShaftReference.jsx`

These support inspection, orientation, and readability.

---

## Editing rules

When changing this codebase:

- treat the mathematical definition as authoritative
- do not reshape the blade by eye
- do not introduce visual interpretation that overrides the equations
- keep the scene readable during rotation
- preserve correct z-axis shaft logic
- preserve orbit controls and camera target correctness
- preserve mobile layout when making desktop improvements
- identify all affected files before patching
- prefer targeted edits over broad rewrites

---

## Decision hierarchy

Use this priority order when making decisions:

1. governing math
2. original technical / conceptual intent
3. current validated implementation
4. visual polish choices

Visual preferences should never silently replace mathematical fidelity.

---

## Common upgrade categories for this repo

Typical future changes will likely involve:

- layout refinement
- sticky viewport / independent control scroll
- startup view tuning
- view preset refinement
- surface readability improvements
- debug overlay additions
- math-faithful domain extensions
- validation improvements
- technical annotation or inspection tooling

These should be added in a way that strengthens the viewer as a technical tool.

---

## What to check before patching

Before changing files, identify whether the request affects:

- UI layout
- startup defaults
- rendering only
- camera/view logic
- assembly logic
- spin behavior
- probe/debug tooling
- mesh generation
- governing math
- validation logic

Do not assume a request is single-file unless the code clearly shows that.

---

## Patch workflow expectation

Preferred workflow for edit tasks:

1. inspect the request against current file responsibilities
2. identify exactly which files are affected
3. explain why those files are involved
4. patch only those files
5. return complete updated file contents ready to paste
6. avoid rewriting unrelated files

---

## Practical summary

This repository is a browser-based technical viewer for a mathematically defined propeller-like surface.

Its job is to make the geometry understandable, adjustable, inspectable, and discussable without losing fidelity to the original underlying mathematical idea.
