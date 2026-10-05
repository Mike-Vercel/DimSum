import "server-only";
import webpush from "web-push";
import { db, type Prisma } from "../db";
import { env, features } from "../env";
import { logger } from "../logger";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** Same tag = the new notification replaces the previous one (order progress). */
  tag?: string;
  requireInteraction?: boolean;
  /** Plays the staff alert sound when the page is open. */
  kind?: "order" | "staff-new-order" | "rider-assignment" | "marketing";
}

let configured = false;
function configure(): boolean {
  if (!features().webPush) return false;
  if (!configured) {
    const e = env();
    webpush.setVapidDetails(
      e.VAPID_SUBJECT ?? `mailto:${e.EMAIL_FROM.replace(/.*<|>.*/g, "")}`,
      e.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      e.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return true;
}

/** Sends a Web Push to every matching subscription; expired endpoints are removed. */
export async function pushTo(
  where: Prisma.PushSubscriptionWhereInput,
  payload: PushPayload,
): Promise<number> {
  if (!configure()) return 0;
  const subs = await db.pushSubscription.findMany({ where: { ...where, failedAt: null } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payload, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png" }),
          { TTL: 60 * 30, urgency: payload.kind === "staff-new-order" ? "high" : "normal" },
        );
        sent++;
        await db.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          logger.warn("web push failed", { status, endpoint: s.endpoint.slice(0, 60) });
        }
      }
    }),
  );
  return sent;
}
