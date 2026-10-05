import { loyaltyRewardInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getLoyaltyAdmin, saveReward } from "@/server/services/admin/promotions";

export const POST = apiRoute({ auth: "loyalty:manage" }, async ({ body, viewer }) => {
  await saveReward(await body(loyaltyRewardInput), viewer!);
  return getLoyaltyAdmin();
});
