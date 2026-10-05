import { analyticsQuery } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getAnalytics } from "@/server/services/admin/reports";

export const GET = apiRoute({ auth: "analytics:read" }, async ({ query }) => {
  const q = query(analyticsQuery);
  return getAnalytics(q.range, { from: q.from, to: q.to });
});
