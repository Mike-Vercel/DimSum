import { availabilityBatchInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { setAvailability } from "@/server/services/admin/catalog";

/** "Esaurito" / "Disponibile nuovamente domani" / "Disponibile" — kitchen staff included. */
export const POST = apiRoute(
  {
    auth: "catalog:availability",
    rateLimit: { name: "availability", limit: 120, windowSeconds: 60, by: "user" },
  },
  async ({ body, viewer }) => {
    const { productIds, ...input } = await body(availabilityBatchInput);
    return { patches: await setAvailability(productIds, input, viewer!) };
  },
);
