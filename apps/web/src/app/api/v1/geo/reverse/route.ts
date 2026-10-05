import { reverseGeocodeQuery } from "@dimsum/validation";
import { AppError } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { reverseGeocode } from "@/server/maps";

/** "Usa la mia posizione" and "Sposta il pin": coordinates → address. */
export const GET = apiRoute(
  { auth: "public", rateLimit: { name: "geo-reverse", limit: 30, windowSeconds: 60 } },
  async ({ query, log }) => {
    const { lat, lng } = query(reverseGeocodeQuery);
    try {
      return { address: await reverseGeocode({ lat, lng }) };
    } catch (error) {
      log.warn("reverse geocoding failed", { error });
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Non riusciamo a trovare l'indirizzo di questa posizione. Inseriscilo a mano.",
      );
    }
  },
);
