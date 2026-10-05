import { cancelOrderRequest } from "@dimsum/validation";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { runOrderCommand } from "@/server/services/orders/commands";
import { getTracking } from "@/server/services/orders/tracking";
import { getRestaurantConfig } from "@/server/services/restaurant";

/** Customer cancellation: only before the kitchen accepts and within the configured window. */
export const POST = apiRoute<{ publicId: string }>(
  { auth: "public", rateLimit: { name: "order-cancel", limit: 10, windowSeconds: 60 } },
  async ({ params, body, viewer }) => {
    const { reason } = await body(cancelOrderRequest);
    const order = await db.order.findUnique({ where: { publicId: params.publicId } });
    if (!order) throw notFound("Ordine");
    const config = await getRestaurantConfig();
    if ((Date.now() - order.placedAt.getTime()) / 60_000 > config.customerCancelWindowMinutes) {
      throw new AppError(
        "INVALID_TRANSITION",
        "Non è più possibile annullare online: contatta il ristorante.",
      );
    }
    await runOrderCommand(
      order.id,
      { type: "CANCEL", reason },
      { actor: "customer", userId: viewer?.userId ?? null },
    );
    return getTracking(order.publicId);
  },
);
