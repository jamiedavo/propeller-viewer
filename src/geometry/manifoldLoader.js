import wasmUrl from "manifold-3d/manifold.wasm?url";

let wasmPromise = null;

/**
 * Lazily loads the manifold-3d WASM module (only when the user exports a solid
 * STL, so it doesn't weigh down the initial page load).
 */
export function loadManifold() {
  if (!wasmPromise) {
    wasmPromise = import("manifold-3d")
      .then((mod) => mod.default({ locateFile: () => wasmUrl }))
      .then((wasm) => {
        wasm.setup();
        return wasm;
      })
      .catch((err) => {
        wasmPromise = null; // allow a retry on the next export
        throw err;
      });
  }
  return wasmPromise;
}
