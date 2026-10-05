import { riderLocationInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { recordRiderLocation } from "@/server/services/rider";

/** Batched GPS points during a delivery; the answer tells the app whether to keep sharing. */
export const POST = apiRoute(
  { auth: "rider:self", rateLimit: { name: "rider-location-in", limit: 40, windowSeconds: 60, by: "user" } },
  async ({ viewer, body }) => recordRiderLocation(viewer!.userId, await body(riderLocationInput)),
);
