/**
 * Seeds a fresh database with the REAL DIMSUM data: restaurant settings, opening hours,
 * delivery zones, the live promotion and the full catalog with photos. No demo content.
 *
 *   npm run db:seed
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, "../../../../.env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { getDb } = await import("../client");
const { seedReference } = await import("./reference");
const { importCatalog, loadCatalog } = await import("./import-catalog");
const { seedAccounts } = await import("./accounts");

const db = getDb();
try {
  const catalog = loadCatalog();
  await seedReference(db, catalog);
  const report = await importCatalog(db, catalog);
  const accounts = await seedAccounts(db);
  console.log("[seed] reference data ready (settings, hours, zones, promotions, allergens)");
  console.log("[seed] catalog", JSON.stringify(report));
  console.log(
    accounts.length ? `[seed] accounts created: ${accounts.join(", ")}` : "[seed] no new bootstrap accounts",
  );
} finally {
  await db.$disconnect();
}
