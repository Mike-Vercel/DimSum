import "server-only";
import { after } from "next/server";
import { logger } from "./logger";

/** Runs work after the response when inside a request, immediately otherwise (cron, scripts). */
export function runAfter(task: () => Promise<unknown>) {
  const safe = () => task().catch((error: unknown) => logger.error("background task failed", { error }));
  try {
    after(safe);
  } catch {
    void safe();
  }
}
