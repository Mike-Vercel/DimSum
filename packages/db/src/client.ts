import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export type Database = PrismaClient;

export interface CreateDatabaseOptions {
  connectionString?: string;
  /** Pool size per server instance. Keep it small on serverless (Vercel) and use a pooled URL. */
  max?: number;
  log?: boolean;
}

export function createDatabase(options: CreateDatabaseOptions = {}): Database {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({
    connectionString,
    max: options.max ?? Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter,
    log: options.log ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

const globalForDb = globalThis as unknown as { __dimsumDb?: Database };

/** Process-wide client, reused across hot reloads in development. */
export function getDb(): Database {
  if (!globalForDb.__dimsumDb) globalForDb.__dimsumDb = createDatabase();
  return globalForDb.__dimsumDb;
}

/**
 * Lazily-initialised client: importing this module never opens a connection, which keeps
 * builds and unrelated routes independent from the database.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
