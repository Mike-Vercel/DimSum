import { z } from "zod";
import { db } from "@/server/db";
import { features } from "@/server/env";
import { AppError, notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { handlePaymentFailed, handlePaymentSucceeded } from "@/server/services/payments";

/**
 * Payment simulator for local development and test environments without Stripe keys. Runs the
 * same server-side handlers the Stripe webhook runs. Refused when the simulator is disabled.
 */
export const POST = apiRoute<{ publicId: string }>(
  { auth: "public", rateLimit: { name: "dev-pay", limit: 20, windowSeconds: 60 } },
  async ({ params, body }) => {
    if (features().paymentProvider !== "dev")
      throw new AppError("FORBIDDEN", "Simulatore di pagamento non disponibile.");
    const { outcome } = await body(z.object({ outcome: z.enum(["succeed", "fail"]) }));
    const order = await db.order.findUnique({
      where: { publicId: params.publicId },
      include: { payments: { where: { provider: "DEV" }, take: 1 } },
    });
    const payment = order?.payments[0];
    if (!order || !payment?.providerPaymentId) throw notFound("Pagamento");
    if (outcome === "succeed") {
      await handlePaymentSucceeded({
        providerPaymentId: payment.providerPaymentId,
        cardBrand: "visa",
        cardLast4: "4242",
        wallet: null,
      });
    } else {
      await handlePaymentFailed(payment.providerPaymentId, {
        code: "card_declined",
        message: "La carta è stata rifiutata (simulazione).",
      });
    }
    return { ok: true };
  },
);
