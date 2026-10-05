import { z } from "zod";
import {
  cents,
  deliveryDetails,
  email,
  fulfillmentType,
  geocodedAddress,
  isoDateTime,
  latLng,
  optionalText,
  personName,
  phone,
  uuid,
} from "./common";

export const cartLine = z.object({
  lineId: uuid,
  productId: uuid,
  variantId: uuid.nullable().default(null),
  quantity: z.number().int().min(1).max(30),
  modifiers: z
    .array(z.object({ modifierId: uuid, quantity: z.number().int().min(1).max(10) }))
    .max(30)
    .default([]),
  notes: optionalText(200),
  /** Unit price the customer saw, used to detect price changes. */
  expectedUnitPriceCents: cents.optional(),
});
export type CartLine = z.infer<typeof cartLine>;

export const cartLines = z.array(cartLine).max(60);

export const deliveryTarget = z.object({
  location: latLng,
  precision: z.enum(["rooftop", "street", "approximate"]).default("rooftop"),
});

export const cartQuoteRequest = z.object({
  lines: cartLines,
  fulfillmentType: fulfillmentType.default("DELIVERY"),
  delivery: deliveryTarget.nullable().default(null),
  couponCode: z.string().trim().max(40).nullable().default(null),
  tipCents: cents.max(5_000).default(0),
  scheduledFor: isoDateTime.nullable().default(null),
});
export type CartQuoteRequest = z.infer<typeof cartQuoteRequest>;

export const accountCartSync = z.object({
  lines: cartLines,
  couponCode: z.string().trim().max(40).nullable().default(null),
});

export const deliveryQuoteRequest = z.object({
  location: latLng,
  precision: z.enum(["rooftop", "street", "approximate"]).default("rooftop"),
  subtotalCents: cents.default(0),
});

export const checkoutCustomer = z.object({
  name: personName,
  email,
  phone: phone.nullable().default(null),
});

export const checkoutRequest = z
  .object({
    /** Generated once per checkout attempt on the client; repeated submissions return the same order. */
    idempotencyKey: uuid,
    lines: cartLines.min(1, { error: "Il carrello è vuoto." }),
    fulfillmentType,
    scheduledFor: isoDateTime.nullable().default(null),
    address: geocodedAddress.extend(deliveryDetails.shape).nullable().default(null),
    customer: checkoutCustomer,
    couponCode: z.string().trim().max(40).nullable().default(null),
    tipCents: cents.max(5_000).default(0),
    paymentMethod: z.enum(["ONLINE", "CASH_ON_DELIVERY"]),
    kitchenNotes: optionalText(300),
    ageConfirmed: z.boolean().default(false),
    marketingConsent: z.boolean().default(false),
    saveAddress: z.boolean().default(false),
    /** Total shown to the customer when pressing "Paga": the server refuses silent changes. */
    expectedTotalCents: cents,
    /** Discount shown with that total: tells a lost promotion apart from a price change. */
    expectedDiscountCents: cents.optional(),
    source: z.enum(["web", "pwa", "ios", "android"]).default("web"),
  })
  .refine((v) => v.fulfillmentType === "PICKUP" || v.address !== null, {
    error: "Inserisci l'indirizzo di consegna.",
    path: ["address"],
  });
export type CheckoutRequest = z.infer<typeof checkoutRequest>;

export const cancelOrderRequest = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const claimOrderRequest = z.object({
  publicId: z.string().min(16).max(64),
});

export const addressSuggestQuery = z.object({
  q: z.string().trim().min(3).max(120),
  session: z.string().max(64).optional(),
});

export const placeDetailsQuery = z.object({
  id: z.string().min(1).max(400),
  session: z.string().max(64).optional(),
});

export const reverseGeocodeQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const savedAddressInput = geocodedAddress.extend(deliveryDetails.shape).extend({
  label: optionalText(40),
  isDefault: z.boolean().default(false),
});

export const slotsQuery = z.object({
  fulfillmentType: fulfillmentType,
});

export const productSearchQuery = z.object({
  q: z.string().trim().min(1).max(80),
});
