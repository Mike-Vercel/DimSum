import { couponInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { archiveCoupon, saveCoupon } from "@/server/services/admin/promotions";

export const PUT = apiRoute<{ id: string }>({ auth: "coupons:manage" }, async ({ params, body, viewer }) =>
  saveCoupon(await body(couponInput), viewer!, parseId(params.id, "Coupon")),
);

export const DELETE = apiRoute<{ id: string }>({ auth: "coupons:manage" }, async ({ params, viewer }) => {
  await archiveCoupon(parseId(params.id, "Coupon"), viewer!);
  return { ok: true };
});
