import { apiRoute } from "@/server/http";
import { getDeliveryArea } from "@/server/services/delivery";

/** Delivery zones with their shapes, for the "Dove consegniamo" map. */
export const GET = apiRoute({ auth: "public" }, async () => getDeliveryArea());
