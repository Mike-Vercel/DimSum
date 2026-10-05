import "server-only";
import type { Viewer } from "./auth/session";
import { db, type Prisma } from "./db";
import { privacyHash } from "./security";

/**
 * Append-only record of staff actions (who changed what, before → after). Read in
 * "Registro attività"; never shown to customers.
 */
export async function audit(
  entry: {
    actor: Pick<Viewer, "userId" | "role"> | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  },
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: entry.actor?.userId ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before:
        entry.before === undefined
          ? undefined
          : (JSON.parse(JSON.stringify(entry.before)) as Prisma.InputJsonValue),
      after:
        entry.after === undefined
          ? undefined
          : (JSON.parse(JSON.stringify(entry.after)) as Prisma.InputJsonValue),
      ipHash: entry.ip ? privacyHash(entry.ip) : null,
      userAgent: entry.userAgent?.slice(0, 300) ?? null,
    },
  });
}
