import { z } from "zod";
import {
  cents,
  email,
  fulfillmentType,
  hhmm,
  isoDateTime,
  latLng,
  optionalText,
  personName,
  phone,
  uuid,
} from "./common";

const allergen = z.enum([
  "GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOYBEANS",
  "MILK",
  "NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHITES",
  "LUPIN",
  "MOLLUSCS",
]);
const productTag = z.enum([
  "VEGETARIAN",
  "VEGAN",
  "SPICY",
  "NEW",
  "BESTSELLER",
  "CONTAINS_COLOURANTS",
  "ALCOHOLIC",
]);

/* ---------------------------------------------------------------- orders */

export const orderCommandRequest = z.discriminatedUnion("command", [
  z.object({ command: z.literal("CONFIRM"), prepMinutes: z.number().int().min(1).max(240) }),
  z.object({ command: z.literal("REJECT"), reason: z.string().trim().min(3).max(300) }),
  z.object({ command: z.literal("START_PREPARING") }),
  z.object({ command: z.literal("MARK_READY") }),
  z.object({ command: z.literal("ASSIGN_RIDER"), riderId: uuid }),
  z.object({ command: z.literal("UNASSIGN_RIDER") }),
  z.object({ command: z.literal("PICK_UP") }),
  z.object({ command: z.literal("DELIVER") }),
  z.object({ command: z.literal("CANCEL"), reason: z.string().trim().min(3).max(300) }),
  z.object({ command: z.literal("UPDATE_PREP_TIME"), prepMinutes: z.number().int().min(1).max(240) }),
]);
export type OrderCommandRequest = z.infer<typeof orderCommandRequest>;

export const refundRequest = z.object({
  idempotencyKey: uuid,
  amountCents: cents.min(1),
  reason: z.string().trim().min(3).max(300),
});

export const adminOrdersQuery = z.object({
  status: z.string().max(200).optional(),
  fulfillmentType: fulfillmentType.optional(),
  q: z.string().trim().max(80).optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/* ---------------------------------------------------------------- catalog */

export const categoryInput = z.object({
  name: z.string().trim().min(2).max(60),
  description: optionalText(300),
  isVisible: z.boolean().default(true),
  coverImageId: uuid.nullable().default(null),
});

export const reorderInput = z.object({
  ids: z.array(uuid).min(1).max(500),
});

export const variantInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(40),
  priceCents: cents,
  isAvailable: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const productInput = z.object({
  categoryId: uuid,
  name: z.string().trim().min(2).max(100),
  nameZh: optionalText(60),
  description: optionalText(600),
  descriptionZh: optionalText(300),
  ingredients: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  posCode: optionalText(12),
  priceCents: cents.min(0),
  vatRateBps: z.number().int().min(0).max(2_500).default(1_000),
  isVisible: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  tags: z.array(productTag).max(7).default([]),
  spicyLevel: z.number().int().min(0).max(3).default(0),
  excludedFromDiscounts: z.boolean().default(false),
  allergens: z.array(allergen).max(14).default([]),
  mayContainAllergens: z.array(allergen).max(14).default([]),
  allergensDeclared: z.boolean().default(false),
  maxQuantityPerLine: z.number().int().min(1).max(99).default(30),
  modifierGroupIds: z.array(uuid).max(20).default([]),
  variants: z.array(variantInput).max(10).default([]),
});
export type ProductInput = z.infer<typeof productInput>;

export const availabilityInput = z.object({
  isAvailable: z.boolean(),
  /** "tomorrow" = back at the first service window of the next day. */
  until: z
    .union([z.literal("tomorrow"), isoDateTime])
    .nullable()
    .default(null),
});

export const availabilityBatchInput = availabilityInput.extend({
  productIds: z.array(uuid).min(1).max(200),
});

export const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(100).optional(),
  status: z.string().max(40).optional(),
});

export const modifierGroupInput = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: optionalText(200),
    minSelect: z.number().int().min(0).max(20),
    maxSelect: z.number().int().min(1).max(20),
    maxTotalQuantity: z.number().int().min(1).max(50),
    isActive: z.boolean().default(true),
    options: z
      .array(
        z.object({
          id: uuid.optional(),
          name: z.string().trim().min(1).max(60),
          priceDeltaCents: z.number().int().min(-10_000).max(100_000),
          isAvailable: z.boolean().default(true),
          maxQuantity: z.number().int().min(1).max(10).default(1),
          allergens: z.array(allergen).max(14).default([]),
        }),
      )
      .min(1)
      .max(40),
  })
  .refine((g) => g.minSelect <= g.maxSelect, {
    error: "Il minimo non può superare il massimo.",
    path: ["minSelect"],
  })
  .refine((g) => g.maxSelect <= g.options.length, {
    error: "Il massimo supera il numero di opzioni.",
    path: ["maxSelect"],
  });

export const imageUploadMeta = z.object({
  productId: uuid,
  alt: z.string().trim().min(2).max(140),
});

/* ---------------------------------------------------------------- restaurant */

export const settingsInput = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: optionalText(120),
  legalName: optionalText(120),
  vatNumber: optionalText(20),
  phone: phone.nullable().default(null),
  email: email.nullable().default(null),
  supportEmail: email.nullable().default(null),
  street: z.string().trim().min(2).max(120),
  streetNumber: z.string().trim().min(1).max(12),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(40),
  formattedAddress: z.string().trim().min(5).max(240),
  location: latLng,
  googleReviewUrl: z.url().nullable().default(null),
  instagramUrl: z.url().nullable().default(null),
  facebookUrl: z.url().nullable().default(null),
  orderNumberPrefix: z
    .string()
    .trim()
    .regex(/^[A-Z]{1,4}$/, { error: "Da 1 a 4 lettere maiuscole." }),
  deliveryEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  autoAcceptOrders: z.boolean(),
  acceptanceEscalationMinutes: z.number().int().min(1).max(60),
  defaultPrepMinutes: z.number().int().min(1).max(120),
  prepTimeOptions: z.array(z.number().int().min(1).max(240)).min(1).max(10),
  schedulingEnabled: z.boolean(),
  slotIntervalMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  deliveryLeadMinutes: z.number().int().min(0).max(240),
  pickupLeadMinutes: z.number().int().min(0).max(240),
  maxScheduleDays: z.number().int().min(0).max(14),
  lastOrderBufferMinutes: z.number().int().min(0).max(120),
  maxRouteDistanceMeters: z.number().int().min(500).max(50_000).nullable(),
  maxTravelSeconds: z.number().int().min(300).max(7_200).nullable(),
  customerCancelWindowMinutes: z.number().int().min(0).max(240),
  onlinePaymentsEnabled: z.boolean(),
  cashOnDeliveryEnabled: z.boolean(),
  cashOnPickupEnabled: z.boolean(),
  tipsEnabled: z.boolean(),
  tipOptionsCents: z.array(cents.max(5_000)).max(5),
  serviceFeeCents: cents.max(1_000),
  phoneRequiredForDelivery: z.boolean(),
  phoneRequiredForPickup: z.boolean(),
  newOrderSoundEnabled: z.boolean(),
  newOrderSound: z.enum(["chime", "bell", "gong"]),
});
export type SettingsInput = z.infer<typeof settingsInput>;

export const pauseOrdersInput = z.object({
  paused: z.boolean(),
  minutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .nullable()
    .default(null),
  reason: optionalText(140),
});

export const openingHoursInput = z.object({
  kind: z.enum(["VENUE", "DELIVERY", "PICKUP"]),
  ranges: z
    .array(z.object({ weekday: z.number().int().min(1).max(7), opensAt: hhmm, closesAt: hhmm }))
    .max(7 * 6),
});

export const closureInput = z
  .object({
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    reason: optionalText(140),
    appliesTo: z.array(fulfillmentType).max(2).default([]),
    isHoliday: z.boolean().default(false),
  })
  .refine((c) => new Date(c.endsAt) > new Date(c.startsAt), {
    error: "La fine deve essere dopo l'inizio.",
    path: ["endsAt"],
  });

export const deliveryZoneInput = z
  .object({
    name: z.string().trim().min(2).max(60),
    type: z.enum(["POLYGON", "CIRCLE", "DISTANCE_BAND"]),
    isActive: z.boolean(),
    priority: z.number().int().min(1).max(100),
    deliveryFeeCents: cents.max(5_000),
    minimumOrderCents: cents.max(20_000),
    freeDeliveryThresholdCents: cents.max(50_000).nullable(),
    etaAdjustmentMinutes: z.number().int().min(-15).max(60),
    polygon: z.array(latLng).min(3).max(400).nullable(),
    center: latLng.nullable(),
    radiusMeters: z.number().int().min(50).max(30_000).nullable(),
    minDistanceMeters: z.number().int().min(0).max(50_000).nullable(),
    maxDistanceMeters: z.number().int().min(100).max(50_000).nullable(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .default(null),
  })
  .refine((z) => z.type !== "POLYGON" || (z.polygon?.length ?? 0) >= 3, {
    error: "Disegna almeno 3 punti.",
    path: ["polygon"],
  })
  .refine((z) => z.type !== "CIRCLE" || (z.center && z.radiusMeters), {
    error: "Indica centro e raggio.",
    path: ["radiusMeters"],
  })
  .refine((z) => z.type !== "DISTANCE_BAND" || z.maxDistanceMeters !== null, {
    error: "Indica la distanza massima della fascia.",
    path: ["maxDistanceMeters"],
  });

/* ---------------------------------------------------------------- people */

export const riderInput = z.object({
  name: personName,
  email,
  phone: phone.nullable().default(null),
  vehicle: optionalText(40),
  password: z.string().min(10, { error: "Almeno 10 caratteri." }).max(128).optional(),
});

export const staffInput = z.object({
  name: personName,
  email,
  role: z.enum(["STAFF", "ADMIN"]),
  /** Omitted = the person receives an invitation to choose it. */
  password: z.string().min(10, { error: "Almeno 10 caratteri." }).max(128).optional(),
});

export const staffUpdateInput = z
  .object({
    role: z.enum(["STAFF", "ADMIN", "SUPER_ADMIN"]).optional(),
    disabled: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.disabled !== undefined, { error: "Nessuna modifica." });

export const riderUpdateInput = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  phone: phone.nullable().optional(),
  vehicle: optionalText(40).optional(),
  isActive: z.boolean().optional(),
});

export const supportReplyInput = z.object({
  body: z.string().trim().min(2).max(4000),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
});

export const supportStatusInput = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export const assignRiderInput = z.object({ riderId: uuid });

/* ---------------------------------------------------------------- promotions & loyalty */

export const couponInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,30}$/, { error: "Da 3 a 30 caratteri: lettere, numeri e trattini." })
      .nullable(),
    name: z.string().trim().min(2).max(80),
    description: optionalText(300),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_DELIVERY"]),
    percentBps: z.number().int().min(100).max(10_000).nullable(),
    amountCents: cents.max(100_000).nullable(),
    maxDiscountCents: cents.nullable(),
    minSubtotalCents: cents.nullable(),
    startsAt: isoDateTime.nullable(),
    endsAt: isoDateTime.nullable(),
    isActive: z.boolean(),
    autoApply: z.boolean(),
    isPublic: z.boolean(),
    maxRedemptions: z.number().int().min(1).max(1_000_000).nullable(),
    perCustomerLimit: z.number().int().min(1).max(1_000).nullable(),
    fulfillmentTypes: z.array(fulfillmentType).max(2),
    newCustomersOnly: z.boolean(),
    includedProductIds: z.array(uuid).max(500),
    includedCategoryIds: z.array(uuid).max(100),
  })
  .refine((c) => c.type !== "PERCENTAGE" || c.percentBps !== null, {
    error: "Indica la percentuale.",
    path: ["percentBps"],
  })
  .refine((c) => c.type !== "FIXED_AMOUNT" || c.amountCents !== null, {
    error: "Indica l'importo.",
    path: ["amountCents"],
  })
  .refine((c) => c.autoApply || c.code !== null, {
    error: "Serve un codice, oppure attiva l'applicazione automatica.",
    path: ["code"],
  })
  .refine((c) => !c.startsAt || !c.endsAt || new Date(c.endsAt) > new Date(c.startsAt), {
    error: "La fine deve essere dopo l'inizio.",
    path: ["endsAt"],
  });
export type CouponInput = z.infer<typeof couponInput>;

export const loyaltyConfigInput = z.object({
  enabled: z.boolean(),
  programName: z.string().trim().min(2).max(40),
  pointsPerEuro: z.number().int().min(1).max(100),
  expiryMonths: z.number().int().min(1).max(60).nullable(),
  birthdayBonusPoints: z.number().int().min(0).max(10_000),
  signupBonusPoints: z.number().int().min(0).max(10_000),
  tiers: z
    .array(
      z.object({
        key: z
          .string()
          .trim()
          .regex(/^[a-z0-9-]{2,20}$/),
        name: z.string().trim().min(2).max(30),
        minLifetimePoints: z.number().int().min(0).max(1_000_000),
        multiplierBps: z.number().int().min(10_000).max(50_000),
      }),
    )
    .max(6),
});

export const loyaltyRewardInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalText(300),
  pointsCost: z.number().int().min(1).max(1_000_000),
  couponType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_DELIVERY"]),
  percentBps: z.number().int().min(100).max(10_000).nullable(),
  amountCents: cents.max(100_000).nullable(),
  validDays: z.number().int().min(1).max(365),
  isActive: z.boolean(),
});

export const analyticsQuery = z.object({
  range: z.enum(["today", "7d", "30d", "custom"]).default("7d"),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
});

export const loyaltyAdjustInput = z.object({
  userId: uuid,
  points: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((n) => n !== 0),
  description: z.string().trim().min(3).max(140),
});
