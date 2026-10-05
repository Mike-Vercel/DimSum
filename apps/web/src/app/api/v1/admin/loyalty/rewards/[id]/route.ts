import { loyaltyRewardInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { getLoyaltyAdmin, saveReward } from "@/server/services/admin/promotions";

export const PUT = apiRoute<{ id: string }>({ auth: "loyalty:manage" }, async ({ params, body, viewer }) => {
  await saveReward(await body(loyaltyRewardInput), viewer!, parseId(params.id, "Premio"));
  return getLoyaltyAdmin();
});
