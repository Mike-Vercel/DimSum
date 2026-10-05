#!/usr/bin/env node
/**
 * Server for the Playwright suite: a production build on its own port, backed by an isolated
 * database (TEST_DATABASE_URL). Setup is non-destructive: pending migrations are applied and the
 * idempotent seed loads the real catalog; every test creates its own customers and orders.
 * Ordering hours cover the whole day so the flows never depend on the time the suite runs.
 *
 *   npm run test:e2e        (Playwright starts this script automatically)
 *   E2E_SKIP_BUILD=1 …      reuse the previous build
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(web, "../..");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const testUrl = process.env.TEST_DATABASE_URL;
// Safety net: the suite only ever touches a database that is explicitly a test database.
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test")) {
  console.error("[e2e] TEST_DATABASE_URL deve puntare a un database il cui nome termina con _test.");
  process.exit(1);
}
const port = process.env.E2E_PORT ?? "3100";
const origin = `http://localhost:${port}`;
Object.assign(process.env, {
  DATABASE_URL: testUrl,
  DIRECT_DATABASE_URL: testUrl,
  APP_URL: origin,
  BETTER_AUTH_URL: origin,
  PAYMENT_PROVIDER: "dev",
  // Production build + local payment simulator: allowed only because this is not Vercel production.
  ALLOW_DEV_PAYMENTS: "true",
  EMAIL_PROVIDER: "outbox",
  MAPS_PROVIDER: "osm",
  STORAGE_PROVIDER: "local",
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
});
delete process.env.NODE_ENV;

const shell = process.platform === "win32";
const npm = shell ? "npm.cmd" : "npm";
// npm/npx are .cmd scripts on Windows (need a shell); node itself must not go through one.
const run = (command, args, cwd) => {
  const r = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: shell && command !== process.execPath,
  });
  if (r.status !== 0) {
    console.error(`[e2e] failed: ${command} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
};

const portOpen = (p, host) =>
  new Promise((resolve) => {
    const socket = net.connect({ port: p, host });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

// Local runs use the embedded PostgreSQL; CI provides its own service.
const db = new URL(testUrl);
if (["127.0.0.1", "localhost"].includes(db.hostname) && !(await portOpen(Number(db.port), db.hostname))) {
  spawn(process.execPath, [path.join(root, "packages/db/scripts/dev-postgres.mjs")], {
    stdio: "ignore",
    detached: true,
    env: process.env,
  }).unref();
  for (let i = 0; i < 120 && !(await portOpen(Number(db.port), db.hostname)); i++)
    await new Promise((r) => setTimeout(r, 500));
}

console.log("[e2e] preparing the test database …");
run("npx", ["prisma", "migrate", "deploy"], path.join(root, "packages/db"));
run(npm, ["run", "seed", "-w", "@dimsum/db"], root);

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: testUrl });
await client.connect();
await client.query(`DELETE FROM "opening_hours" WHERE "kind" IN ('DELIVERY', 'PICKUP')`);
for (const kind of ["DELIVERY", "PICKUP"]) {
  for (let weekday = 1; weekday <= 7; weekday++) {
    await client.query(
      `INSERT INTO "opening_hours" ("id", "kind", "weekday", "opensAt", "closesAt", "position") VALUES (gen_random_uuid(), $1, $2, '00:00', '23:59', 0)`,
      [kind, weekday],
    );
  }
}
await client.query(`DELETE FROM "closures"`);
await client.query(
  `UPDATE "restaurant_settings" SET "ordersPaused" = false, "pausedUntil" = NULL, "autoAcceptOrders" = false, "lastOrderBufferMinutes" = 0`,
);
await client.end();

if (!(process.env.E2E_SKIP_BUILD && fs.existsSync(path.join(web, ".next-e2e", "BUILD_ID")))) {
  console.log("[e2e] building …");
  run(process.execPath, [path.join(web, "scripts/run-next.mjs"), "build"], web);
}

console.log(`[e2e] starting on ${origin}`);
const server = spawn(process.execPath, [path.join(web, "scripts/run-next.mjs"), "start", "-p", port], {
  cwd: web,
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
