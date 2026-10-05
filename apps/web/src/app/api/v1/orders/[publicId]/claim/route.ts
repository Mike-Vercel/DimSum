import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { refreshCustomerStats } from "@/server/services/customers";
import { placedFromThisBrowser } from "@/server/services/orders/tracking";

/**
 * Attaches a guest order to the signed-in account. Allowed when the e-mail matches AND either
 * the order was placed from this browser (signed cookie) or the account e-mail is verified.
 */
export const POST = apiRoute<{ publicId: string }>(
  { auth: "user", rateLimit: { name: "order-claim", limit: 10, windowSeconds: 60 } },
  async ({ params, viewer }) => {
    const order = await db.order.findUnique({ where: { publicId: params.publicId } });
    if (!order) throw notFound("Ordine");
    if (order.userId === viewer!.userId) return { ok: true };
    if (order.userId) throw new AppError("FORBIDDEN", "Questo ordine appartiene a un altro account.");
    const sameEmail = order.customerEmail === viewer!.email.toLowerCase();
    const possession = await placedFromThisBrowser(order.publicId);
    if (!sameEmail || !(possession || viewer!.emailVerified)) {
      throw new AppError(
        "FORBIDDEN",
        "Per collegare l'ordine usa lo stesso indirizzo e-mail dell'ordine e conferma la tua e-mail.",
      );
    }
    await db.order.update({
      where: { id: order.id },
      data: { userId: viewer!.userId, claimedAt: new Date() },
    });
    await refreshCustomerStats(viewer!.userId);
    return { ok: true };
  },
);
