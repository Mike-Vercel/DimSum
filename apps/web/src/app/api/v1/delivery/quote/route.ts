import { deliveryQuoteRequest } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { resolveDelivery } from "@/server/services/delivery";

/** Zone, fee, minimum order and ETA for an address — or the reason it cannot be served. */
export const POST = apiRoute(
  { auth: "public", rateLimit: { name: "delivery-quote", limit: 60, windowSeconds: 60 } },
  async ({ body }) => {
    const input = await body(deliveryQuoteRequest);
    const { quote } = await resolveDelivery(input.location, input.precision);
    return quote;
  },
);
