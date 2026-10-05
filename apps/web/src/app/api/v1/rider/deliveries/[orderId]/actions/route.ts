import { riderDeliveryAction } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { riderDeliveryAction as runRiderAction } from "@/server/services/rider";

export const POST = apiRoute<{ orderId: string }>(
  { auth: "rider:self", rateLimit: { name: "rider-action", limit: 60, windowSeconds: 60, by: "user" } },
  async ({ viewer, params, body }) =>
    runRiderAction(viewer!.userId, parseId(params.orderId, "Ordine"), await body(riderDeliveryAction)),
);
