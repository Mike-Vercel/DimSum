import "server-only";
import { SUPPORT_CATEGORY_LABELS, firstNameOf } from "@dimsum/domain";
import type { SupportTicketDTO } from "@dimsum/types";
import type { supportTicketInput } from "@dimsum/validation";
import type { z } from "zod";
import type { Viewer } from "../auth/session";
import { runAfter } from "../background";
import { db, Prisma } from "../db";
import { brandContext, sendEmail, supportReceivedEmail, supportStaffEmail } from "../email";
import { appUrl } from "../env";
import { AppError } from "../errors";
import { newReference } from "../ids";
import { publish } from "../realtime/bus";
import { pushTo } from "./push";
import { getRestaurantConfig } from "./restaurant";

type TicketRow = Prisma.SupportTicketGetPayload<object>;

export function toTicketDTO(t: TicketRow): SupportTicketDTO {
  return {
    id: t.id,
    reference: t.reference,
    category: t.category,
    status: t.status,
    subject: t.subject,
    createdAt: t.createdAt.toISOString(),
  };
}

/**
 * Opens a support request. For an order, the tracking link is the proof of identity: contact
 * details default to the ones given at checkout, so the customer only has to describe the problem.
 */
export async function createSupportTicket(
  input: z.output<typeof supportTicketInput>,
  viewer: Viewer | null,
): Promise<SupportTicketDTO> {
  const order = input.orderPublicId
    ? await db.order.findUnique({
        where: { publicId: input.orderPublicId },
        select: {
          id: true,
          displayNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
        },
      })
    : null;
  if (input.orderPublicId && !order) throw new AppError("NOT_FOUND", "Ordine non trovato.");

  const name = input.name ?? viewer?.name ?? order?.customerName;
  const email = (input.email ?? viewer?.email ?? order?.customerEmail)?.toLowerCase();
  if (!name || !email)
    throw new AppError("VALIDATION_FAILED", "Inserisci nome ed e-mail per ricevere la risposta.");
  const categoryLabel = SUPPORT_CATEGORY_LABELS[input.category];
  const subject =
    input.subject ?? (order ? `Ordine #${order.displayNumber} · ${categoryLabel}` : categoryLabel);

  let ticket: TicketRow | null = null;
  for (let attempt = 0; !ticket; attempt++) {
    try {
      ticket = await db.supportTicket.create({
        data: {
          reference: newReference("AS"),
          userId: viewer?.userId ?? null,
          orderId: order?.id ?? null,
          email,
          name,
          phone: input.phone ?? order?.customerPhone ?? null,
          category: input.category,
          subject,
          messages: { create: { body: input.message, authorUserId: viewer?.userId ?? null } },
        },
      });
    } catch (error) {
      // Six random characters: a collision is rare but possible, just draw another reference.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || attempt >= 3)
        throw error;
    }
  }

  const created = ticket;
  runAfter(async () => {
    const url = `/admin/assistenza/${created.id}`;
    await db.notification.create({
      data: {
        audience: "STAFF",
        orderId: created.orderId,
        type: "SUPPORT_REQUEST",
        category: "OPERATIONAL",
        title: `Assistenza ${created.reference}`,
        body: subject,
        url,
      },
    });
    await publish(["kitchen"], {
      type: "support.created",
      ticketId: created.id,
      reference: created.reference,
      subject,
    });
    await pushTo(
      { topic: "staff" },
      {
        title: `Richiesta di assistenza ${created.reference}`,
        body: subject,
        url,
        tag: `support-${created.id}`,
      },
    );

    const [brand, config] = await Promise.all([brandContext(), getRestaurantConfig()]);
    await sendEmail({
      to: email,
      orderId: created.orderId,
      email: supportReceivedEmail(brand, {
        firstName: firstNameOf(name),
        reference: created.reference,
        subject,
      }),
    });
    const staffInbox = config.supportEmail ?? config.email;
    if (staffInbox) {
      await sendEmail({
        to: staffInbox,
        orderId: created.orderId,
        replyTo: email,
        email: supportStaffEmail(brand, {
          reference: created.reference,
          category: categoryLabel,
          subject,
          message: input.message,
          name,
          email,
          phone: created.phone,
          orderNumber: order?.displayNumber ?? null,
          adminUrl: appUrl(url),
        }),
      });
    }
  });

  return toTicketDTO(created);
}
