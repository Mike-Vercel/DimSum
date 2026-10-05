import { assertCronRequest } from "@/server/cron";
import { apiRoute } from "@/server/http";
import { endExpiredPauses, escalateWaitingOrders } from "@/server/services/maintenance";
import { expireUnpaidOrders } from "@/server/services/payments";

/** Every minute: unaccepted-order alerts, abandoned online payments, timed pauses. */
export const maxDuration = 60;

export const GET = apiRoute({ auth: "public" }, async ({ req }) => {
  assertCronRequest(req.headers);
  const now = new Date();
  const [escalated, expired, reopened] = await Promise.all([
    escalateWaitingOrders(now),
    expireUnpaidOrders(30),
    endExpiredPauses(now),
  ]);
  return { escalated, expired, reopened };
});
