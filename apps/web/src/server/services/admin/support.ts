import "server-only";
import { firstNameOf } from "@dimsum/domain";
import type { AdminSupportTicketDTO, Paginated, SupportStatus } from "@dimsum/types";
import type { Viewer } from "../../auth/session";
import { audit } from "../../audit";
import { db, type Prisma } from "../../db";
import { brandContext, sendEmail, supportReplyEmail } from "../../email";
import { AppError } from "../../errors";
import { logger } from "../../logger";
import { publish } from "../../realtime/bus";

const ticketInclude = {
  order: { select: { id: true, publicId: true, displayNumber: true } },
  messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
} satisfies Prisma.SupportTicketInclude;

type TicketRow = Prisma.SupportTicketGetPayload<{ include: typeof ticketInclude }>;

function toAdminTicket(t: TicketRow, withMessages: boolean): AdminSupportTicketDTO {
  const last = t.messages.at(-1);
  return {
    id: t.id,
    reference: t.reference,
    category: t.category,
    status: t.status,
    subject: t.subject,
    name: t.name,
    email: t.email,
    phone: t.phone,
    order: t.order ? { id: t.order.id, publicId: t.order.publicId, number: t.order.displayNumber } : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    lastMessagePreview: (last?.body ?? "").slice(0, 160),
    ...(withMessages
      ? {
          messages: t.messages.map((m) => ({
            id: m.id,
            fromStaff: m.fromStaff,
            authorName: m.author?.name ?? null,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
          })),
        }
      : {}),
  };
}

export async function listTickets(query: {
  status?: "open" | "closed";
  cursor?: string;
}): Promise<Paginated<AdminSupportTicketDTO> & { openCount: number }> {
  const limit = 40;
  const open: SupportStatus[] = ["OPEN", "IN_PROGRESS"];
  const where: Prisma.SupportTicketWhereInput =
    query.status === "closed"
      ? { status: { notIn: open } }
      : query.status === "open"
        ? { status: { in: open } }
        : {};
  const [rows, openCount] = await Promise.all([
    db.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    db.supportTicket.count({ where: { status: { in: open } } }),
  ]);
  const page = rows.slice(0, limit);
  return {
    items: page.map((t) => toAdminTicket(t, false)),
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    openCount,
  };
}

export async function getTicket(ticketId: string): Promise<AdminSupportTicketDTO> {
  const t = await db.supportTicket.findUnique({ where: { id: ticketId }, include: ticketInclude });
  if (!t) throw new AppError("NOT_FOUND", "Richiesta non trovata.");
  return toAdminTicket(t, true);
}

/** Staff reply: e-mailed to the customer (who can answer by e-mail) and kept in the thread. */
export async function replyToTicket(
  ticketId: string,
  input: { body: string; status?: SupportStatus | undefined },
  actor: Viewer,
): Promise<AdminSupportTicketDTO> {
  const status = input.status ?? "IN_PROGRESS";
  const t = await db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError("NOT_FOUND", "Richiesta non trovata.");
    await tx.supportMessage.create({
      data: { ticketId, fromStaff: true, authorUserId: actor.userId, body: input.body },
    });
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status } });
    await audit(
      {
        actor,
        action: "support.replied",
        entityType: "SupportTicket",
        entityId: ticketId,
        after: { status },
      },
      tx,
    );
    return tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId }, include: ticketInclude });
  });
  try {
    const brand = await brandContext();
    await sendEmail({
      to: t.email,
      orderId: t.orderId,
      email: supportReplyEmail(brand, {
        firstName: firstNameOf(t.name),
        reference: t.reference,
        subject: t.subject,
        body: input.body,
        staffName: firstNameOf(actor.name),
      }),
    });
    if (t.userId) {
      const n = await db.notification.create({
        data: {
          userId: t.userId,
          orderId: t.orderId,
          type: "SUPPORT_REPLY",
          category: "TRANSACTIONAL",
          title: "Ti abbiamo risposto",
          body: t.subject,
          url: "/account/notifiche",
        },
      });
      await publish([`user:${t.userId}`], {
        type: "notification",
        notification: {
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          url: n.url,
          readAt: null,
          createdAt: n.createdAt.toISOString(),
        },
      });
    }
  } catch (error) {
    logger.error("support reply delivery failed", { error, ticketId });
  }
  return toAdminTicket(t, true);
}

export async function setTicketStatus(
  ticketId: string,
  status: SupportStatus,
  actor: Viewer,
): Promise<AdminSupportTicketDTO> {
  const t = await db.$transaction(async (tx) => {
    const before = await tx.supportTicket.findUnique({ where: { id: ticketId }, select: { status: true } });
    if (!before) throw new AppError("NOT_FOUND", "Richiesta non trovata.");
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status } });
    await audit(
      {
        actor,
        action: "support.status",
        entityType: "SupportTicket",
        entityId: ticketId,
        before,
        after: { status },
      },
      tx,
    );
    return tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId }, include: ticketInclude });
  });
  return toAdminTicket(t, true);
}
