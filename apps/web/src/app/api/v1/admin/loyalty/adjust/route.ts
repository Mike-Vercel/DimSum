import { loyaltyAdjustInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { adjustPoints } from "@/server/services/admin/promotions";

export const POST = apiRoute({ auth: "loyalty:manage" }, async ({ body, viewer }) => {
  await adjustPoints(await body(loyaltyAdjustInput), viewer!);
  return { ok: true };
});
