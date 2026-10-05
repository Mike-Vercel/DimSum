import "server-only";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import type { BrandContext } from "./layout";
import type { RenderedEmail } from "./templates";

export * from "./templates";

export interface SendEmailInput {
  to: string;
  email: RenderedEmail;
  orderId?: string | null;
  replyTo?: string | null;
}

interface EmailProvider {
  name: string;
  send(input: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  }): Promise<{ id: string | null }>;
}

const resendProvider = (apiKey: string): EmailProvider => ({
  name: "resend",
  async send(m) {
    const { Resend } = await import("resend");
    const client = new Resend(apiKey);
    const res = await client.emails.send({
      from: m.from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    });
    if (res.error) throw new Error(`Resend: ${res.error.message}`);
    return { id: res.data?.id ?? null };
  },
});

const smtpProvider = (url: string): EmailProvider => ({
  name: "smtp",
  async send(m) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(url);
    const info = await transport.sendMail({
      from: m.from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      replyTo: m.replyTo,
    });
    return { id: info.messageId ?? null };
  },
});

/** Development outbox: nothing leaves the machine, messages are stored for the preview at /dev/outbox. */
const outboxProvider: EmailProvider = {
  name: "outbox",
  async send(m) {
    logger.info("email (outbox)", { to: m.to, subject: m.subject });
    return { id: null };
  },
};

function provider(): EmailProvider {
  const e = env();
  if (e.EMAIL_PROVIDER === "resend" && e.RESEND_API_KEY) return resendProvider(e.RESEND_API_KEY);
  if (e.EMAIL_PROVIDER === "smtp" && e.SMTP_URL) return smtpProvider(e.SMTP_URL);
  if (e.NODE_ENV === "production" && e.EMAIL_PROVIDER !== "outbox") {
    logger.error("email provider misconfigured: falling back to outbox", { provider: e.EMAIL_PROVIDER });
  }
  return outboxProvider;
}

/**
 * Sends a transactional e-mail and records it. Never throws: a failed e-mail must not break an
 * order flow — the failure is logged and visible in the admin.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const e = env();
  const p = provider();
  const isOutbox = p.name === "outbox";
  const log = await db.emailLog.create({
    data: {
      to: input.to,
      template: input.email.template,
      subject: input.email.subject,
      provider: p.name,
      orderId: input.orderId ?? null,
      html: isOutbox ? input.email.html : null,
      text: isOutbox ? input.email.text : null,
    },
  });
  try {
    const res = await p.send({
      from: e.EMAIL_FROM,
      to: input.to,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      ...((input.replyTo ?? e.EMAIL_REPLY_TO) ? { replyTo: (input.replyTo ?? e.EMAIL_REPLY_TO)! } : {}),
    });
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: isOutbox ? "SKIPPED" : "SENT", providerMessageId: res.id },
    });
  } catch (error) {
    logger.error("email send failed", { error, template: input.email.template, to: input.to });
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: String(error).slice(0, 500) },
    });
  }
}

export async function brandContext(): Promise<BrandContext> {
  const s = await db.restaurantSettings.findUnique({ where: { id: "default" } });
  const legal = [s?.legalName, s?.vatNumber ? `P.IVA ${s.vatNumber}` : null].filter(Boolean).join(" · ");
  return {
    appUrl: env().APP_URL,
    restaurantName: s?.name ?? "DIMSUM",
    address: s ? `${s.street} ${s.streetNumber}, ${s.postalCode} ${s.city}` : "Palermo",
    phone: s?.phone ?? null,
    legalLine: legal || null,
  };
}
