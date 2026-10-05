import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { AppError } from "./errors";

/** Scheduled jobs are invoked by the platform scheduler with `Authorization: Bearer CRON_SECRET`. */
export function assertCronRequest(headers: Headers): void {
  const secret = env().CRON_SECRET;
  if (!secret) throw new AppError("SERVICE_UNAVAILABLE", "CRON_SECRET non configurato.");
  const given = Buffer.from(headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    throw new AppError("UNAUTHENTICATED");
}
