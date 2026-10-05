import "server-only";
import type { NotificationDTO, Paginated } from "@dimsum/types";
import { db, type Prisma } from "../db";

type NotificationRow = Prisma.NotificationGetPayload<object>;

export function toNotificationDTO(n: NotificationRow): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** The customer's in-app notification centre (order updates, rewards, support replies). */
export async function listNotifications(
  userId: string,
  cursor?: string,
  limit = 30,
): Promise<Paginated<NotificationDTO> & { unread: number }> {
  const where: Prisma.NotificationWhereInput = { userId, audience: "CUSTOMER" };
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  const page = rows.slice(0, limit);
  return {
    items: page.map(toNotificationDTO),
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    unread,
  };
}

export async function markNotificationsRead(
  userId: string,
  filter: { ids?: string[]; before?: string },
): Promise<void> {
  await db.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(filter.ids ? { id: { in: filter.ids } } : {}),
      ...(filter.before ? { createdAt: { lte: new Date(filter.before) } } : {}),
    },
    data: { readAt: new Date() },
  });
}
