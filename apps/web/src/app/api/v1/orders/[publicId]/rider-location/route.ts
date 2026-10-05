import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";

/**
 * Latest rider position for the customer map — only while the order is on its way (after pickup,
 * before delivery). Never before pickup, never afterwards, no history.
 */
export const GET = apiRoute<{ publicId: string }>(
  { auth: "public", rateLimit: { name: "rider-location", limit: 120, windowSeconds: 60 } },
  async ({ params }) => {
    const order = await db.order.findUnique({
      where: { publicId: params.publicId },
      select: {
        pickedUpAt: true,
        deliveredAt: true,
        cancelledAt: true,
        delivery: {
          select: {
            rider: { select: { lastLat: true, lastLng: true, lastHeading: true, lastLocationAt: true } },
          },
        },
      },
    });
    if (!order) throw notFound("Ordine");
    const rider = order.delivery?.rider;
    const live = !!order.pickedUpAt && !order.deliveredAt && !order.cancelledAt;
    if (!live || rider?.lastLat == null || rider.lastLng == null || !rider.lastLocationAt)
      return { location: null };
    return {
      location: {
        lat: Math.round(rider.lastLat * 1e5) / 1e5,
        lng: Math.round(rider.lastLng * 1e5) / 1e5,
        heading: rider.lastHeading,
        speed: null,
        accuracy: null,
        recordedAt: rider.lastLocationAt.toISOString(),
      },
    };
  },
);
