#!/usr/bin/env node
/**
 * MapLibre GL 6 loads its web worker relative to the library module. After bundling that URL no
 * longer exists, so the worker (and the shared chunk it imports) is served from /maplibre and
 * registered with setWorkerUrl(). Runs before dev and build to stay in sync with the installed version.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(web, "package.json"));
const dist = path.dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = path.join(web, "public", "maplibre");
fs.mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  fs.copyFileSync(path.join(dist, file), path.join(out, file));
}
console.log("[maplibre] worker copied to public/maplibre");
