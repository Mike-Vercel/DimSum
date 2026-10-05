import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env files: load the monorepo root .env when present (local dev).
// The CLI always runs from packages/db (npm workspace scripts).
for (const file of [path.resolve(process.cwd(), "../../.env"), path.resolve(process.cwd(), ".env")]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

// Migrations need a direct (non-pooled) connection; the app runtime uses DATABASE_URL.
// DATABASE_URL_UNPOOLED is the name used by the Neon integration on Vercel.
const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed/index.ts",
  },
  ...(url ? { datasource: { url } } : {}),
});
