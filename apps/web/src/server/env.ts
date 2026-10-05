import "server-only";
import { z } from "zod";
import type { ProviderButton } from "@/lib/auth-providers";

/**
 * Server environment, validated once on first access. Secrets never leave the server: only
 * NEXT_PUBLIC_* values (see lib/public-env.ts) are inlined in client bundles.
 */
const optional = z
  .string()
  .trim()
  .transform((v) => (v.length ? v : undefined))
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  APP_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: optional,

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  APPLE_CLIENT_ID: optional,
  APPLE_CLIENT_SECRET: optional,
  APPLE_APP_BUNDLE_IDENTIFIER: optional,

  PAYMENT_PROVIDER: z.enum(["stripe", "dev"]).optional(),
  ALLOW_DEV_PAYMENTS: z.enum(["true", "false"]).optional(),
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional,

  MAPS_PROVIDER: z.enum(["google", "mapbox", "osm"]).default("osm"),
  GOOGLE_MAPS_API_KEY: optional,
  MAPBOX_ACCESS_TOKEN: optional,
  PHOTON_URL: z.url().default("https://photon.komoot.io"),
  NOMINATIM_URL: z.url().default("https://nominatim.openstreetmap.org"),
  OSRM_URL: z.url().default("https://router.project-osrm.org"),
  GEO_CONTACT_EMAIL: optional,

  EMAIL_PROVIDER: z.enum(["resend", "smtp", "outbox"]).default("outbox"),
  EMAIL_FROM: z.string().default("DIMSUM <ordini@dimsum.it>"),
  EMAIL_REPLY_TO: optional,
  RESEND_API_KEY: optional,
  SMTP_URL: optional,

  STORAGE_PROVIDER: z.enum(["vercel-blob", "local"]).default("local"),
  BLOB_READ_WRITE_TOKEN: optional,

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,

  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,

  CRON_SECRET: optional,
  HASH_SALT: z.string().min(16).default("dimsum-development-salt"),

  APPLE_TEAM_ID: optional,
  IOS_BUNDLE_ID: optional,
  ANDROID_PACKAGE_NAME: optional,
  ANDROID_SHA256_CERT_FINGERPRINTS: optional,
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === "production" && e.HASH_SALT === "dimsum-development-salt") {
    throw new Error("HASH_SALT must be set in production");
  }
  cached = e;
  return e;
}

export const isProduction = () => env().NODE_ENV === "production";

/** The payment simulator is never available on the production deployment. */
function devPaymentsAllowed(e: ServerEnv): boolean {
  if (e.VERCEL_ENV === "production") return false;
  if (e.NODE_ENV !== "production") return true;
  return e.ALLOW_DEV_PAYMENTS === "true";
}

export function features() {
  const e = env();
  const stripeConfigured = !!(e.STRIPE_SECRET_KEY && e.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const paymentProvider: "stripe" | "dev" | null =
    e.PAYMENT_PROVIDER === "dev" && devPaymentsAllowed(e)
      ? "dev"
      : stripeConfigured
        ? "stripe"
        : devPaymentsAllowed(e)
          ? "dev"
          : null;
  const googleAuth = !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
  const googleButton: ProviderButton = googleAuth ? "on" : e.NODE_ENV === "production" ? "off" : "setup";
  return {
    googleAuth,
    googleButton,
    appleAuth: !!(e.APPLE_CLIENT_ID && e.APPLE_CLIENT_SECRET),
    paymentProvider,
    stripeWebhooks: !!e.STRIPE_WEBHOOK_SECRET,
    webPush: !!(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY),
    upstash: !!(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN),
    mapsProvider:
      e.MAPS_PROVIDER === "google" && e.GOOGLE_MAPS_API_KEY
        ? ("google" as const)
        : e.MAPS_PROVIDER === "mapbox" && e.MAPBOX_ACCESS_TOKEN
          ? ("mapbox" as const)
          : ("osm" as const),
  };
}

export function appUrl(path = "/"): string {
  return new URL(path, env().APP_URL).toString();
}
