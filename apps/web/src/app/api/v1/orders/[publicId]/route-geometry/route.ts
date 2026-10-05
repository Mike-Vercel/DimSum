import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { routeBetween } from "@/server/maps";
import { getRestaurantConfig } from "@/server/services/restaurant";

/** Route line restaurant → customer for the tracking map (cached by the routing layer). */
export const GET = apiRoute<{ publicId: string }>(
  { auth: "public", rateLimit: { name: "route-geometry", limit: 30, windowSeconds: 60 } },
  async ({ params }) => {
    const order = await db.order.findUnique({
      where: { publicId: params.publicId },
      select: { fulfillmentType: true, addressLat: true, addressLng: true, deliveredAt: true },
    });
    if (!order) throw notFound("Ordine");
    if (
      order.fulfillmentType !== "DELIVERY" ||
      order.addressLat === null ||
      order.addressLng === null ||
      order.deliveredAt
    )
      return { geometry: null };
    const config = await getRestaurantConfig();
    const route = await routeBetween(
      config.location,
      { lat: order.addressLat, lng: order.addressLng },
      { geometry: true },
    );
    return { geometry: route.geometry };
  },
);
