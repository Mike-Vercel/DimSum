import { cartQuoteRequest } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { quoteCart } from "@/server/services/quote";
import { getRestaurantConfig } from "@/server/services/restaurant";

/** Authoritative cart pricing (prices, availability, zone, minimum, promotions, totals). */
export const POST = apiRoute(
  { auth: "public", rateLimit: { name: "cart-quote", limit: 120, windowSeconds: 60 } },
  async ({ body, viewer }) => {
    const input = await body(cartQuoteRequest);
    const config = await getRestaurantConfig();
    const { dto } = await quoteCart(input, {
      config,
      now: new Date(),
      customer: { userId: viewer?.userId ?? null, email: viewer?.email ?? null },
    });
    return dto;
  },
);
