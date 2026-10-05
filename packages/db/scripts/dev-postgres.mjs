#!/usr/bin/env node
/**
 * Local PostgreSQL 17 for development and tests — real Postgres binaries shipped through npm,
 * no Docker required. Data lives in `<repo>/.data/postgres` and survives restarts.
 *
 *   npm run db:start          # keeps running in the foreground (Ctrl+C to stop)
 *
 * Production uses a managed PostgreSQL (Neon / Vercel Postgres / Supabase) through DATABASE_URL.
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(root, ".data", "postgres");
const port = Number(process.env.DEV_POSTGRES_PORT ?? 54329);
const databases = ["dimsum", "dimsum_test"];

function portInUse(p) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: p, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

if (await portInUse(port)) {
  console.log(`[db] PostgreSQL already running on 127.0.0.1:${port}`);
  process.exit(0);
}

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "dimsum",
  password: "dimsum",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (e) => console.error("[db]", e),
});

const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) {
  console.log("[db] initialising a new cluster in .data/postgres …");
  await pg.initialise();
}
await pg.start();
for (const name of databases) {
  try {
    await pg.createDatabase(name);
    console.log(`[db] created database ${name}`);
  } catch {
    // already exists
  }
}
console.log(`[db] PostgreSQL ready on postgresql://dimsum:dimsum@127.0.0.1:${port}/dimsum (Ctrl+C to stop)`);

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log("\n[db] stopping PostgreSQL …");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
