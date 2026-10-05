import "server-only";
import type {
  AdminCustomerDetailDTO,
  AdminCustomerListItemDTO,
  AdminStaffDTO,
  AuditEntryDTO,
  Paginated,
  Role,
} from "@dimsum/types";
import type { staffInput } from "@dimsum/validation";
import type { z } from "zod";
import type { Viewer } from "../../auth/session";
import { audit } from "../../audit";
import { db, type Prisma } from "../../db";
import { AppError, notFound } from "../../errors";
import { currentConsents } from "../consents";
import { adminOrderInclude, REAL_ORDER, toAdminListItem } from "./orders";
import { createTeamAccount, sendTeamInvite, setAccountDisabled } from "./people";

/* ---------------------------------------------------------------- customers */

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  emailVerified: true,
  customerProfile: { select: { ordersCount: true, totalSpentCents: true, lastOrderAt: true, segment: true } },
} satisfies Prisma.UserSelect;

type CustomerRow = Prisma.UserGetPayload<{ select: typeof customerSelect }>;

function toCustomerItem(u: CustomerRow, marketingEmail: boolean): AdminCustomerListItemDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    createdAt: u.createdAt.toISOString(),
    ordersCount: u.customerProfile?.ordersCount ?? 0,
    totalSpentCents: u.customerProfile?.totalSpentCents ?? 0,
    lastOrderAt: u.customerProfile?.lastOrderAt?.toISOString() ?? null,
    segment: u.customerProfile?.segment ?? "NEW",
    marketingEmail,
  };
}

export async function listCustomers(query: {
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<Paginated<AdminCustomerListItemDTO>> {
  const limit = Math.min(query.limit ?? 50, 100);
  const q = query.q?.trim();
  const rows = await db.user.findMany({
    where: {
      role: "CUSTOMER",
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q.replace(/\s+/g, "") } },
            ],
          }
        : {}),
    },
    select: customerSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  const consents = await db.consentRecord.findMany({
    where: {
      type: "MARKETING_EMAIL",
      OR: [{ userId: { in: page.map((u) => u.id) } }, { email: { in: page.map((u) => u.email) } }],
    },
    orderBy: { createdAt: "desc" },
    select: { userId: true, email: true, granted: true },
  });
  const marketing = (u: CustomerRow) =>
    consents.find((c) => c.userId === u.id || c.email === u.email)?.granted ?? false;
  return {
    items: page.map((u) => toCustomerItem(u, marketing(u))),
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function getCustomer(userId: string): Promise<AdminCustomerDetailDTO> {
  const u = await db.user.findFirst({
    where: { id: userId, role: "CUSTOMER" },
    select: {
      ...customerSelect,
      addresses: { select: { formatted: true } },
      loyaltyAccount: { select: { points: true } },
    },
  });
  if (!u) throw new AppError("NOT_FOUND", "Cliente non trovato.");
  const [orders, consentLog, latest] = await Promise.all([
    db.order.findMany({
      where: { AND: [REAL_ORDER, { userId }] },
      include: adminOrderInclude,
      orderBy: { placedAt: "desc" },
      take: 50,
    }),
    db.consentRecord.findMany({
      where: { OR: [{ userId }, { email: u.email }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    currentConsents(userId, u.email),
  ]);
  return {
    ...toCustomerItem(u, latest.MARKETING_EMAIL ?? false),
    emailVerified: u.emailVerified,
    loyaltyPoints: u.loyaltyAccount?.points ?? 0,
    addresses: u.addresses.map((a) => a.formatted),
    orders: orders.map(toAdminListItem),
    consents: consentLog.map((c) => ({
      type: c.type,
      granted: c.granted,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

/* ---------------------------------------------------------------- staff */

const TEAM_ROLES: Role[] = ["STAFF", "ADMIN", "SUPER_ADMIN"];

export async function listStaff(): Promise<AdminStaffDTO[]> {
  const users = await db.user.findMany({
    where: { role: { in: TEAM_ROLES }, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      disabledAt: true,
      createdAt: true,
      sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
    },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    disabled: !!u.disabledAt,
    createdAt: u.createdAt.toISOString(),
    lastSessionAt: u.sessions[0]?.updatedAt.toISOString() ?? null,
  }));
}

export async function createStaff(input: z.output<typeof staffInput>, actor: Viewer): Promise<void> {
  const { invited } = await db.$transaction(async (tx) => {
    const account = await createTeamAccount(
      { name: input.name, email: input.email, role: input.role, password: input.password },
      tx,
    );
    await audit(
      {
        actor,
        action: "staff.created",
        entityType: "User",
        entityId: account.userId,
        after: { name: input.name, email: input.email, role: input.role },
      },
      tx,
    );
    return account;
  });
  if (invited) await sendTeamInvite(input.email);
}

/** Role changes and deactivation. Nobody can lock themselves out or remove the last owner. */
export async function updateStaff(
  userId: string,
  input: { role?: "STAFF" | "ADMIN" | "SUPER_ADMIN"; disabled?: boolean },
  actor: Viewer,
): Promise<void> {
  if (userId === actor.userId)
    throw new AppError("FORBIDDEN", "Non puoi modificare il tuo stesso ruolo o disattivarti.");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, role: { in: TEAM_ROLES } } });
    if (!user) throw notFound("Account");
    if (user.role === "SUPER_ADMIN" && (input.disabled || (input.role && input.role !== "SUPER_ADMIN"))) {
      const owners = await tx.user.count({
        where: { role: "SUPER_ADMIN", disabledAt: null, id: { not: userId } },
      });
      if (owners === 0) throw new AppError("CONFLICT", "Deve restare almeno un titolare attivo.");
    }
    if (input.role) await tx.user.update({ where: { id: userId }, data: { role: input.role } });
    if (input.disabled !== undefined) await setAccountDisabled(userId, input.disabled, tx);
    // A role change must apply now, not when the session cookie cache expires.
    if (input.role && input.role !== user.role) await tx.session.deleteMany({ where: { userId } });
    await audit(
      {
        actor,
        action: "staff.updated",
        entityType: "User",
        entityId: userId,
        before: { role: user.role, disabled: !!user.disabledAt },
        after: input,
      },
      tx,
    );
  });
}

/* ---------------------------------------------------------------- audit */

export async function listAudit(query: {
  entityType?: string;
  entityId?: string;
  cursor?: string;
  limit?: number;
}): Promise<Paginated<AuditEntryDTO>> {
  const limit = Math.min(query.limit ?? 50, 100);
  const rows = await db.auditLog.findMany({
    where: {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    },
    include: { actor: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((a) => ({
      id: a.id,
      actorName: a.actor?.name ?? null,
      actorRole: a.actorRole,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      before: a.before,
      after: a.after,
      createdAt: a.createdAt.toISOString(),
    })),
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}
