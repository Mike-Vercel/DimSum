import { riderAvailabilityInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { setRiderOnline } from "@/server/services/rider";

/** "Inizia il turno" / "Chiudi il turno". */
export const PUT = apiRoute(
  {
    auth: "rider:self",
    rateLimit: { name: "rider-availability", limit: 30, windowSeconds: 300, by: "user" },
  },
  async ({ viewer, body }) => setRiderOnline(viewer!.userId, (await body(riderAvailabilityInput)).online),
);
