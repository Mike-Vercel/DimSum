import { addressSuggestQuery } from "@dimsum/validation";
import { AppError } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { suggestAddresses } from "@/server/maps";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const GET = apiRoute(
  { auth: "public", rateLimit: { name: "geo-suggest", limit: 60, windowSeconds: 60 } },
  async ({ query, log }) => {
    const { q, session } = query(addressSuggestQuery);
    const config = await getRestaurantConfig();
    try {
      return { suggestions: await suggestAddresses(q, config.location, session) };
    } catch (error) {
      log.warn("address suggest failed", { error });
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "La ricerca degli indirizzi non risponde. Riprova o usa la tua posizione.",
      );
    }
  },
);
