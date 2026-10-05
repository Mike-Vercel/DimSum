import "server-only";
import { runAfter } from "../background";
import { endExpiredPauses, escalateWaitingOrders } from "./maintenance";
import { expireUnpaidOrders } from "./payments";

/** Order-flow housekeeping: orders waiting too long, abandoned online payments, timed pauses. */
export async function runOperations(now = new Date()) {
  const [escalated, expired, reopened] = await Promise.all([
    escalateWaitingOrders(now),
    expireUnpaidOrders(30),
    endExpiredPauses(now),
  ]);
  return { escalated, expired, reopened };
}

const EVERY_MS = 60_000;
let lastRun = 0;

/**
 * Runs the housekeeping from ordinary traffic, at most once a minute per server instance and after
 * the response has been sent. During service the kitchen screen refreshes every 20 seconds, so
 * alerts stay timely without a per-minute cron (Vercel Hobby only allows daily cron jobs). Every
 * job claims its rows atomically: instances running it at the same moment never act twice.
 */
export function scheduleOperations(): void {
  const now = Date.now();
  if (now - lastRun < EVERY_MS) return;
  lastRun = now;
  runAfter(() => runOperations());
}
