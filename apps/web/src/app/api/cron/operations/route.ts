import { assertCronRequest } from "@/server/cron";
import { apiRoute } from "@/server/http";
import { runOperations } from "@/server/services/operations";

/**
 * Order-flow housekeeping on demand. The app already runs it from ordinary traffic (see
 * scheduleOperations); on Vercel Pro, or with an external scheduler, this endpoint can also be
 * called every minute with "Authorization: Bearer <CRON_SECRET>".
 */
export const maxDuration = 60;

export const GET = apiRoute({ auth: "public" }, async ({ req }) => {
  assertCronRequest(req.headers);
  return runOperations();
});
