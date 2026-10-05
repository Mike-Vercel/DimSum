import { z } from "zod";
import { email, isoDateTime, optionalText, personName, phone } from "./common";

export const updateProfile = z.object({
  name: personName,
  phone: phone.nullable().default(null),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data non valida." })
    .nullable()
    .default(null),
});

export const consentType = z.enum([
  "TERMS",
  "PRIVACY",
  "MARKETING_EMAIL",
  "MARKETING_PUSH",
  "PERSONALIZATION",
  "ANALYTICS",
]);

export const updateConsents = z.object({
  consents: z
    .array(z.object({ type: consentType, granted: z.boolean() }))
    .min(1)
    .max(6),
  /** Where the choice was made, kept in the consent log. */
  source: z.enum(["signup", "account"]).default("account"),
});

export const cookieConsent = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
});

export const pushSubscriptionInput = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  orderPublicId: z.string().max(64).nullable().default(null),
  topic: z.enum(["customer", "staff", "rider"]).default("customer"),
});

export const deviceTokenInput = z.object({
  platform: z.enum(["IOS", "ANDROID"]),
  token: z.string().min(10).max(400),
  appVersion: optionalText(20),
});

/**
 * Support request. For an order the contact details are optional: the tracking link already
 * proves who the customer is, so we reply to the order's e-mail unless another one is given.
 */
export const supportTicketInput = z
  .object({
    category: z.enum(["ORDER_ISSUE", "PAYMENT", "DELIVERY", "MISSING_ITEM", "OTHER"]),
    subject: z.string().trim().min(3, { error: "Oggetto troppo breve." }).max(120).optional(),
    message: z.string().trim().min(10, { error: "Descrivi il problema in almeno 10 caratteri." }).max(4000),
    orderPublicId: z.string().max(64).nullable().default(null),
    name: personName.optional(),
    email: email.optional(),
    phone: phone.nullable().default(null),
  })
  .refine((v) => v.orderPublicId || (v.name && v.email), {
    error: "Inserisci nome ed e-mail per ricevere la risposta.",
    path: ["email"],
  });

export const deleteAccountRequest = z.object({
  confirmation: z.literal("ELIMINA", { error: 'Scrivi "ELIMINA" per confermare.' }),
});

export const redeemRewardRequest = z.object({
  rewardId: z.uuid(),
});

export const notificationsReadRequest = z.object({
  ids: z.array(z.uuid()).max(100).optional(),
  before: isoDateTime.optional(),
});
