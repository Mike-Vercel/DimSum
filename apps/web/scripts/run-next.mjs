#!/usr/bin/env node
/**
 * Runs the Next.js CLI with the monorepo root .env loaded (local development). Variables that are
 * already defined — e.g. injected by Vercel — are never overridden.
 *   node scripts/run-next.mjs dev | build | start
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.resolve(web, "../../.env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
// Next.js decides NODE_ENV itself (development for dev, production for build/start).
delete process.env.NODE_ENV;

const require = createRequire(path.join(web, "package.json"));
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  cwd: web,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
