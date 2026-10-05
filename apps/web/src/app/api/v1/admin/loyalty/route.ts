import { loyaltyConfigInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getLoyaltyAdmin, updateLoyaltyConfig } from "@/server/services/admin/promotions";

export const GET = apiRoute({ auth: "loyalty:manage" }, async () => getLoyaltyAdmin());

export const PUT = apiRoute({ auth: "loyalty:manage" }, async ({ body, viewer }) => {
  await updateLoyaltyConfig(await body(loyaltyConfigInput), viewer!);
  return getLoyaltyAdmin();
});
