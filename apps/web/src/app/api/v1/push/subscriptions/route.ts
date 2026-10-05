import { isStaffRole } from "@dimsum/domain";
import { pushSubscriptionInput } from "@dimsum/validation";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { apiRoute } from "@/server/http";

/** Registers a browser for Web Push (customer order updates, staff new-order alerts, rider jobs). */
export const POST = apiRoute(
  { auth: "public", rateLimit: { name: "push-subscribe", limit: 20, windowSeconds: 60 } },
  async ({ body, viewer, req }) => {
    const input = await body(pushSubscriptionInput);
    if (input.topic === "staff" && !isStaffRole(viewer?.role)) throw new AppError("FORBIDDEN");
    if (input.topic === "rider" && viewer?.role !== "RIDER") throw new AppError("FORBIDDEN");
    let orderId: string | null = null;
    if (input.orderPublicId) {
      const order = await db.order.findUnique({
        where: { publicId: input.orderPublicId },
        select: { id: true },
      });
      if (!order) throw new AppError("NOT_FOUND", "Ordine non trovato.");
      orderId = order.id;
    }
    const data = {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userId: viewer?.userId ?? null,
      orderId,
      topic: input.topic,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      failedAt: null,
    };
    await db.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { endpoint: input.endpoint, ...data },
      update: data,
    });
    return { ok: true };
  },
);

export const DELETE = apiRoute({ auth: "public" }, async ({ query }) => {
  const { endpoint } = query(z.object({ endpoint: z.url() }));
  await db.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true };
});
