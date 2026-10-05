import { apiRoute } from "@/server/http";
import { couponsForUser } from "@/server/services/offers";

export const GET = apiRoute({ auth: "user" }, async ({ viewer }) => ({
  coupons: await couponsForUser(viewer!.userId),
}));
