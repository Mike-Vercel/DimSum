import { checkoutRequest } from "@dimsum/validation";
import { AppError } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { placeOrder } from "@/server/services/checkout";
import { rememberPlacedOrder } from "@/server/services/orders/tracking";

/**
 * Places an order. Idempotent: the same Idempotency-Key always returns the same order, so double
 * taps, refreshes and network retries never create duplicates.
 */
export const POST = apiRoute(
  { auth: "public", rateLimit: { name: "checkout", limit: 12, windowSeconds: 60 }, maxBodyBytes: 128 * 1024 },
  async ({ req, body, viewer }) => {
    const input = await body(checkoutRequest);
    const header = req.headers.get("idempotency-key");
    if (header && header !== input.idempotencyKey)
      throw new AppError("BAD_REQUEST", "Chiave di idempotenza non coerente.");
    const result = await placeOrder(input, { viewer, userAgent: req.headers.get("user-agent") });
    await rememberPlacedOrder(result.publicId);
    return result;
  },
);
