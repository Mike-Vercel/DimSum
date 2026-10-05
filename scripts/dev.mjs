#!/usr/bin/env node
/**
 * One command for local development:
 *   1. starts the embedded PostgreSQL when DATABASE_URL points to the local dev port;
 *   2. applies pending migrations (and seeds the real catalog on an empty database);
 *   3. starts Next.js (web, PWA, admin, rider app and API).
 *
 *   npm run dev
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (!fs.existsSync(envFile)) {
  console.error("[dev] .env mancante: copia .env.example in .env e completa i valori (vedi README).");
  process.exit(1);
}
process.loadEnvFile(envFile);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Set();

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

function background(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

function waitForPort(port, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        if (Date.now() - started > timeoutMs)
          reject(new Error(`PostgreSQL non raggiungibile sulla porta ${port}`));
        else setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

const shutdown = () => {
  for (const child of children) child.kill("SIGINT");
  setTimeout(() => process.exit(0), 1500);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const dbUrl = new URL(process.env.DATABASE_URL ?? "postgresql://dimsum:dimsum@127.0.0.1:54329/dimsum");
const local =
  ["127.0.0.1", "localhost"].includes(dbUrl.hostname) &&
  dbUrl.port === (process.env.DEV_POSTGRES_PORT ?? "54329");

if (local) {
  background(process.execPath, [path.join(root, "packages/db/scripts/dev-postgres.mjs")]);
  await waitForPort(Number(dbUrl.port));
}

await run(npm, ["run", "db:deploy"]);

// First run: an empty database gets the real DIMSUM catalog, settings and bootstrap accounts.
const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "restaurant_settings"`);
await client.end();
if (rows[0].n === 0) {
  console.log("[dev] database vuoto: importo il catalogo reale DIMSUM …");
  await run(npm, ["run", "db:seed"]);
}

background(npm, ["run", "dev", "-w", "@dimsum/web"]);
