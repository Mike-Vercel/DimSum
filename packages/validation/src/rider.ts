import { z } from "zod";
import { cents, isoDateTime } from "./common";

export const riderLocationInput = z.object({
  deliveryId: z.uuid().nullable().default(null),
  points: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy: z.number().min(0).max(10_000).nullable().default(null),
        heading: z.number().min(0).max(360).nullable().default(null),
        speed: z.number().min(0).max(100).nullable().default(null),
        recordedAt: isoDateTime,
      }),
    )
    .min(1)
    .max(30),
});

export const riderAvailabilityInput = z.object({
  online: z.boolean(),
});

export const riderDeliveryAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("TO_RESTAURANT") }),
  z.object({ action: z.literal("ARRIVED") }),
  z.object({ action: z.literal("PICKED_UP") }),
  z.object({ action: z.literal("START_DELIVERY") }),
  z.object({ action: z.literal("DELIVERED"), cashCollectedCents: cents.nullable().default(null) }),
]);
export type RiderDeliveryAction = z.infer<typeof riderDeliveryAction>;
