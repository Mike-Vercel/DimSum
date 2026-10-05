import { notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { scheduleOperations } from "@/server/services/operations";
import { getTracking } from "@/server/services/orders/tracking";

/** Public tracking. Knowing the unguessable id is the capability; enumeration is rate limited. */
export const GET = apiRoute<{ publicId: string }>(
  { auth: "public", rateLimit: { name: "tracking", limit: 120, windowSeconds: 60 } },
  async ({ params }) => {
    scheduleOperations();
    const tracking = await getTracking(params.publicId);
    if (!tracking) throw notFound("Ordine");
    return tracking;
  },
);
