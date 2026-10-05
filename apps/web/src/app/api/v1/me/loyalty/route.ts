import { apiRoute } from "@/server/http";
import { loyaltySummary } from "@/server/services/loyalty";

export const GET = apiRoute({ auth: "user" }, async ({ viewer }) => loyaltySummary(viewer!.userId));
