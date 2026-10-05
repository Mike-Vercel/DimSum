import { refundRequest } from "@dimsum/validation";
import { audit } from "@/server/audit";
import { apiRoute, parseId } from "@/server/http";
import { getAdminOrder } from "@/server/services/admin/orders";
import { refundOrder } from "@/server/services/payments";

/** Full or partial refund through the payment gateway (idempotent per request key). */
export const POST = apiRoute<{ id: string }>(
  { auth: "orders:refund", rateLimit: { name: "admin-refund", limit: 20, windowSeconds: 300, by: "user" } },
  async ({ params, body, viewer, ip, req }) => {
    const orderId = parseId(params.id, "Ordine");
    const input = await body(refundRequest);
    const result = await refundOrder(orderId, input.amountCents, input.reason, {
      actorUserId: viewer!.userId,
      idempotencyKey: input.idempotencyKey,
    });
    await audit({
      actor: viewer,
      action: "order.refund",
      entityType: "Order",
      entityId: orderId,
      after: { ...result, reason: input.reason },
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return getAdminOrder(orderId);
  },
);
