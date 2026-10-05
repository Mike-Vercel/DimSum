import { couponInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { listCoupons, saveCoupon } from "@/server/services/admin/promotions";

export const GET = apiRoute({ auth: "coupons:manage" }, async () => ({ coupons: await listCoupons() }));

export const POST = apiRoute({ auth: "coupons:manage" }, async ({ body, viewer }) =>
  json(await saveCoupon(await body(couponInput), viewer!), { status: 201 }),
);
