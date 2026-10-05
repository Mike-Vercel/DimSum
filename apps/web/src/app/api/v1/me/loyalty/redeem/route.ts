import { redeemRewardRequest } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { redeemReward } from "@/server/services/loyalty";

export const POST = apiRoute(
  { auth: "user", rateLimit: { name: "loyalty-redeem", limit: 10, windowSeconds: 300, by: "user" } },
  async ({ viewer, body }) => {
    const { rewardId } = await body(redeemRewardRequest);
    return { coupon: await redeemReward(viewer!.userId, rewardId) };
  },
);
