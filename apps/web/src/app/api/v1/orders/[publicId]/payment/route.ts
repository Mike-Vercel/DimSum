import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";

/** Resume an unfinished online payment (refresh, 3-D Secure interruption). */
export const GET = apiRoute<{ publicId: string }>(
  { auth: "public", rateLimit: { name: "payment-resume", limit: 30, windowSeconds: 60 } },
  async ({ params }) => {
    const order = await db.order.findUnique({
      where: { publicId: params.publicId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) throw notFound("Ordine");
    const payment = order.payments[0];
    return {
      clientSecret: null,
      status: payment?.status ?? "PENDING",
      payOnReceipt: order.paymentMethod !== "ONLINE",
    };
  },
);
