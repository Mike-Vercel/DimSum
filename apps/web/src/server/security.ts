import "server-only";
import { createHmac } from "node:crypto";
import { env } from "./env";

/** Client IP as seen by the platform proxy (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "0.0.0.0";
}

/** Keyed hash for identifiers we must not store in clear (IP addresses in logs and consent records). */
export function privacyHash(value: string): string {
  return createHmac("sha256", env().HASH_SALT).update(value).digest("hex").slice(0, 32);
}

export function sameOrigin(h: Headers): boolean {
  const app = new URL(env().APP_URL);
  const origin = h.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      return o.host === app.host || (env().NODE_ENV !== "production" && o.hostname === "localhost");
    } catch {
      return false;
    }
  }
  const site = h.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}
