import { z } from "zod";

export const uuid = z.uuid({ error: "Identificativo non valido." });

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Inserisci un indirizzo email valido." }).max(254));

/** Italian and international numbers, stored in E.164 (+39…). */
export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .transform((v) => (v.startsWith("00") ? `+${v.slice(2)}` : v))
  .transform((v) => (/^3\d{8,9}$|^0\d{5,10}$/.test(v) ? `+39${v}` : v))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, { error: "Inserisci un numero di telefono valido." }));

export const personName = z
  .string()
  .trim()
  .min(2, { error: "Inserisci nome e cognome." })
  .max(80, { error: "Il nome è troppo lungo." });

export const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Massimo ${max} caratteri.` });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Massimo ${max} caratteri.` })
    .transform((v) => (v.length ? v : null))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const cents = z.number().int().min(0).max(10_000_000);

export const latLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const isoDateTime = z.iso.datetime({ offset: true, error: "Data non valida." });

export const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, { error: "Orario non valido (HH:mm)." });

export const fulfillmentType = z.enum(["DELIVERY", "PICKUP"]);

export const addressFields = z.object({
  street: z.string().trim().min(2).max(120),
  streetNumber: z.string().trim().min(1, { error: "Inserisci il numero civico." }).max(12),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, { error: "CAP non valido." }),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(40),
  country: z.string().trim().length(2).default("IT"),
});

export const deliveryDetails = z.object({
  staircase: optionalText(20),
  floor: optionalText(20),
  apartment: optionalText(20),
  intercom: optionalText(60),
  riderNotes: optionalText(240),
});

export const geocodedAddress = addressFields.extend({
  formatted: z.string().trim().min(5).max(240),
  location: latLng,
  placeId: z.string().max(300).nullable().default(null),
  precision: z.enum(["rooftop", "street", "approximate"]).default("rooftop"),
});

export const pagination = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
