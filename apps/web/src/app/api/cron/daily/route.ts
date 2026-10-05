import { assertCronRequest } from "@/server/cron";
import { apiRoute } from "@/server/http";
import { awardBirthdayBonuses, expireInactivePoints } from "@/server/services/loyalty";
import { purgeExpiredData } from "@/server/services/maintenance";

/** Once a day (night time): Club birthdays and expiries, data retention. */
export const maxDuration = 300;

export const GET = apiRoute({ auth: "public" }, async ({ req }) => {
  assertCronRequest(req.headers);
  const now = new Date();
  const birthdays = await awardBirthdayBonuses(now);
  const expiredPoints = await expireInactivePoints(now);
  const purged = await purgeExpiredData(now);
  return { birthdays, expiredPoints, purged };
});
