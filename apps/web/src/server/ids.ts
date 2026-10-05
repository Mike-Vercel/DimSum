import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Unguessable public identifier (≈ 140 bits) used in tracking links. */
export function newPublicId(length = 24): string {
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      // Rejection sampling keeps the distribution uniform.
      if (b < 256 - (256 % ALPHABET.length)) out += ALPHABET[b % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Short human reference for support tickets ("AS-7K2Q9"). */
export function newReference(prefix: string): string {
  return `${prefix}-${newPublicId(6).toUpperCase()}`;
}

function sign(value: string): string {
  return createHmac("sha256", env().BETTER_AUTH_SECRET).update(value).digest("base64url");
}

export function signValue(value: string): string {
  return `${value}.${sign(value)}`;
}

export function verifySignedValue(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signed.slice(i + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return value;
}
