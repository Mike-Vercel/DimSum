import "server-only";
import { randomBytes } from "node:crypto";
import type { Role } from "@dimsum/types";
import { hashPassword } from "better-auth/crypto";
import { getAuth } from "../../auth/auth";
import { db, type Prisma } from "../../db";
import { AppError } from "../../errors";
import { logger } from "../../logger";

/**
 * Creates a staff or rider account. Without a password the person receives a link to choose one
 * (nobody, not even the admin, ever knows it).
 */
export async function createTeamAccount(
  input: { name: string; email: string; role: Exclude<Role, "CUSTOMER">; password?: string | undefined },
  tx: Prisma.TransactionClient = db,
): Promise<{ userId: string; invited: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AppError(
      "CONFLICT",
      "Esiste già un account con questa e-mail: usa un indirizzo dedicato al lavoro.",
    );
  }
  const password = input.password ?? randomBytes(24).toString("base64url");
  const user = await tx.user.create({
    data: { email, name: input.name, emailVerified: true, role: input.role },
  });
  // Better Auth stores credential accounts with the user id as account id.
  await tx.account.create({
    data: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(password),
    },
  });
  return { userId: user.id, invited: !input.password };
}

/** Sends the "choose your password" e-mail to a new team member (after the transaction commits). */
export async function sendTeamInvite(email: string): Promise<void> {
  try {
    await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/reimposta-password" } });
  } catch (error) {
    logger.error("team invite e-mail failed", { error, email });
  }
}

/** Disabling signs the person out everywhere immediately. */
export async function setAccountDisabled(
  userId: string,
  disabled: boolean,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.user.update({ where: { id: userId }, data: { disabledAt: disabled ? new Date() : null } });
  if (disabled) await tx.session.deleteMany({ where: { userId } });
}
