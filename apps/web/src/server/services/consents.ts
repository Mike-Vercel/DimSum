import "server-only";
import type { ConsentType } from "@dimsum/types";
import { db, type Prisma } from "../db";
import { privacyHash } from "../security";

/** Version of the privacy policy and terms the consents refer to (shown on the legal pages). */
export const POLICY_VERSION = "2026-10";

export interface ConsentInput {
  type: ConsentType;
  granted: boolean;
}

/**
 * Append-only consent log: every change is a new row with source, policy version and a hashed IP,
 * so the current choice and its full history can be proven (GDPR art. 7).
 */
export async function recordConsents(
  consents: ConsentInput[],
  ctx: {
    userId?: string | null;
    email?: string | null;
    anonymousId?: string | null;
    source: string;
    ip?: string | null;
    userAgent?: string | null;
  },
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  if (consents.length === 0) return;
  await tx.consentRecord.createMany({
    data: consents.map((c) => ({
      userId: ctx.userId ?? null,
      email: ctx.email?.toLowerCase() ?? null,
      anonymousId: ctx.anonymousId ?? null,
      type: c.type,
      granted: c.granted,
      source: ctx.source,
      policyVersion: POLICY_VERSION,
      ipHash: ctx.ip ? privacyHash(ctx.ip) : null,
      userAgent: ctx.userAgent?.slice(0, 300) ?? null,
    })),
  });
}

/** Latest choice per consent type for an account (including choices made as a guest with the same e-mail). */
export async function currentConsents(
  userId: string,
  email: string,
): Promise<Partial<Record<ConsentType, boolean>>> {
  const rows = await db.consentRecord.findMany({
    where: { OR: [{ userId }, { email: email.toLowerCase() }] },
    orderBy: { createdAt: "desc" },
    distinct: ["type"],
    select: { type: true, granted: true },
  });
  return Object.fromEntries(rows.map((r) => [r.type, r.granted]));
}
