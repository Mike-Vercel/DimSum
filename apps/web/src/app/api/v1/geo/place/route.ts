import { placeDetailsQuery } from "@dimsum/validation";
import { AppError } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { placeDetails } from "@/server/maps";

export const GET = apiRoute(
  { auth: "public", rateLimit: { name: "geo-place", limit: 40, windowSeconds: 60 } },
  async ({ query, log }) => {
    const { id, session } = query(placeDetailsQuery);
    try {
      const address = await placeDetails(id, session);
      if (!address)
        throw new AppError("NOT_FOUND", "Indirizzo non trovato. Prova a scriverlo in modo diverso.");
      return { address };
    } catch (error) {
      if (error instanceof AppError) throw error;
      log.warn("place details failed", { error });
      throw new AppError("SERVICE_UNAVAILABLE", "Non riusciamo a recuperare l'indirizzo. Riprova tra poco.");
    }
  },
);
