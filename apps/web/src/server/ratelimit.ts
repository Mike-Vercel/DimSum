import "server-only";
import { db } from "./db";
import { features, env } from "./env";
import { logger } from "./logger";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

type Limiter = (key: string, limit: number, windowSeconds: number) => Promise<RateLimitResult>;

/** Fixed window on PostgreSQL: one atomic upsert, shared by every serverless instance. */
const postgresLimiter: Limiter = async (key, limit, windowSeconds) => {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const rows = await db.$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "rate_limits" ("id", "key", "count", "lastRequest")
    VALUES (gen_random_uuid(), ${`api:${key}`}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limits"."lastRequest" < ${windowStart} THEN 1 ELSE "rate_limits"."count" + 1 END,
      "lastRequest" = CASE WHEN "rate_limits"."lastRequest" < ${windowStart} THEN ${now} ELSE "rate_limits"."lastRequest" END
    RETURNING "count", "lastRequest"`;
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const started = Number(row?.lastRequest ?? now);
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((started + windowSeconds * 1000 - now) / 1000)),
  };
};

let upstash: Limiter | null = null;
async function upstashLimiter(): Promise<Limiter> {
  if (upstash) return upstash;
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);
  const redis = new Redis({ url: env().UPSTASH_REDIS_REST_URL!, token: env().UPSTASH_REDIS_REST_TOKEN! });
  const cache = new Map<string, InstanceType<typeof Ratelimit>>();
  upstash = async (key, limit, windowSeconds) => {
    const id = `${limit}:${windowSeconds}`;
    let rl = cache.get(id);
    if (!rl) {
      rl = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(limit, `${windowSeconds} s`),
        prefix: "dimsum:rl",
      });
      cache.set(id, rl);
    }
    const r = await rl.limit(key);
    return {
      ok: r.success,
      remaining: r.remaining,
      retryAfterSeconds: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)),
    };
  };
  return upstash;
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const limiter = features().upstash ? await upstashLimiter() : postgresLimiter;
    return await limiter(key, limit, windowSeconds);
  } catch (error) {
    // Fail open: a limiter outage must not take ordering down.
    logger.warn("rate limiter unavailable", { error });
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}
