import "server-only";
import { runAfter } from "../background";
import { endExpiredPauses, escalateWaitingOrders, openScheduledOrders, sendReviewRequests } from "./maintenance";
import { expireUnpaidOrders } from "./payments";

/**
 * Order-flow housekeeping: orders waiting too long, abandoned online payments, timed pauses, and the
 * review request e-mailed 5 minutes after delivery.
 */
export async function runOperations(now = new Date()) {
  const [opened, escalated, expired, reopened, reviews] = await Promise.all([
    openScheduledOrders(now),
    escalateWaitingOrders(now),
    expireUnpaidOrders(30),
    endExpiredPauses(now),
    sendReviewRequests(now),
  ]);
  return { opened, escalated, expired, reopened, reviews };
}

const EVERY_MS = 30_000;
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
