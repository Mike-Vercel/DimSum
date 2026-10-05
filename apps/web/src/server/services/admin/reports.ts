import "server-only";
import type { AnalyticsDTO, DashboardDTO } from "@dimsum/types";
import { db, Prisma } from "../../db";
import { computeServiceStatus, loadLiveLoad, loadRestaurantConfig } from "../restaurant";
import { adminOrderInclude, REAL_ORDER, toAdminListItem } from "./orders";
import { dayStart, reportRange, type RangeKey } from "./time";

/** Revenue never includes tips: they belong to the riders and are accounted separately. */
const SOLD: Prisma.OrderWhereInput = { AND: [REAL_ORDER, { status: { notIn: ["CANCELLED", "REFUNDED"] } }] };

const minutes = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? null : Math.round(ms / 60_000);

interface TimingRow {
  avg_accept: number | null;
  avg_prep: number | null;
  avg_delivery: number | null;
  on_time: number | null;
}

/** Average service times between two instants (ms), on orders placed in the window. */
async function timings(from: Date, to: Date): Promise<TimingRow> {
  const [row] = await db.$queryRaw<TimingRow[]>`
    SELECT
      AVG(EXTRACT(EPOCH FROM ("confirmedAt" - "receivedAt")) * 1000) FILTER (WHERE "confirmedAt" IS NOT NULL AND "receivedAt" IS NOT NULL)::float8 AS avg_accept,
      AVG(EXTRACT(EPOCH FROM ("readyAt" - "confirmedAt")) * 1000) FILTER (WHERE "readyAt" IS NOT NULL AND "confirmedAt" IS NOT NULL)::float8 AS avg_prep,
      AVG(EXTRACT(EPOCH FROM ("deliveredAt" - "receivedAt")) * 1000) FILTER (WHERE "deliveredAt" IS NOT NULL AND "receivedAt" IS NOT NULL AND "fulfillmentType" = 'DELIVERY' AND "isScheduled" = false)::float8 AS avg_delivery,
      AVG(CASE WHEN "deliveredAt" <= "etaTo" + interval '2 minutes' THEN 1 ELSE 0 END) FILTER (WHERE "deliveredAt" IS NOT NULL AND "etaTo" IS NOT NULL)::float8 AS on_time
    FROM orders
    WHERE "placedAt" >= ${from} AND "placedAt" < ${to} AND status::text NOT IN ('PENDING_PAYMENT', 'CANCELLED', 'REFUNDED')`;
  return row ?? { avg_accept: null, avg_prep: null, avg_delivery: null, on_time: null };
}

export async function getDashboard(now = new Date()): Promise<DashboardDTO> {
  const config = await loadRestaurantConfig();
  const tz = config.timezone;
  const start = dayStart(now, tz);
  const lastWeekStart = new Date(start.getTime() - 7 * 86_400_000);
  const lastWeekNow = new Date(now.getTime() - 7 * 86_400_000);

  const [load, today, todayAll, lastWeek, byStatus, escalated, riders, latest, soldOut, times] =
    await Promise.all([
      loadLiveLoad(),
      db.order.aggregate({
        where: { AND: [SOLD, { placedAt: { gte: start, lt: now } }] },
        _count: { _all: true },
        _sum: { totalCents: true, tipCents: true },
      }),
      db.order.groupBy({
        by: ["fulfillmentType", "status"],
        where: { AND: [REAL_ORDER, { placedAt: { gte: start, lt: now } }] },
        _count: { _all: true },
      }),
      db.order.aggregate({
        where: { AND: [SOLD, { placedAt: { gte: lastWeekStart, lt: lastWeekNow } }] },
        _count: { _all: true },
        _sum: { totalCents: true, tipCents: true },
      }),
      db.order.groupBy({
        by: ["status"],
        where: {
          status: {
            in: [
              "RECEIVED",
              "CONFIRMED",
              "PREPARING",
              "READY_FOR_PICKUP",
              "RIDER_ASSIGNED",
              "RIDER_TO_RESTAURANT",
              "PICKED_UP",
              "ON_THE_WAY",
            ],
          },
        },
        _count: { _all: true },
      }),
      db.order.count({
        where: {
          status: "RECEIVED",
          receivedAt: { lt: new Date(now.getTime() - config.acceptanceEscalationMinutes * 60_000) },
        },
      }),
      db.rider.groupBy({ by: ["availability"], where: { isActive: true }, _count: { _all: true } }),
      db.order.findMany({
        where: REAL_ORDER,
        include: adminOrderInclude,
        orderBy: { placedAt: "desc" },
        take: 8,
      }),
      db.product.findMany({
        where: {
          deletedAt: null,
          isVisible: true,
          isAvailable: false,
          OR: [{ unavailableUntil: null }, { unavailableUntil: { gt: now } }],
        },
        select: { id: true, name: true, unavailableUntil: true },
        orderBy: { name: "asc" },
      }),
      timings(start, now),
    ]);

  const count = (statuses: string[]) =>
    byStatus.filter((s) => statuses.includes(s.status)).reduce((n, s) => n + s._count._all, 0);
  const revenue = (today._sum.totalCents ?? 0) - (today._sum.tipCents ?? 0);
  const orders = today._count._all;
  const ridersBy = (a: string) => riders.find((r) => r.availability === a)?._count._all ?? 0;

  return {
    serverTime: now.toISOString(),
    status: computeServiceStatus(config, load, now),
    pause: { paused: config.ordersPaused, until: config.pausedUntil, reason: config.pauseReason },
    today: {
      orders,
      revenueCents: revenue,
      averageTicketCents: orders ? Math.round(revenue / orders) : 0,
      cancelled: todayAll
        .filter((g) => g.status === "CANCELLED" || g.status === "REFUNDED")
        .reduce((n, g) => n + g._count._all, 0),
      delivery: todayAll
        .filter(
          (g) => g.fulfillmentType === "DELIVERY" && g.status !== "CANCELLED" && g.status !== "REFUNDED",
        )
        .reduce((n, g) => n + g._count._all, 0),
      pickup: todayAll
        .filter((g) => g.fulfillmentType === "PICKUP" && g.status !== "CANCELLED" && g.status !== "REFUNDED")
        .reduce((n, g) => n + g._count._all, 0),
      avgPrepMinutes: minutes(times.avg_prep),
      avgDeliveryMinutes: minutes(times.avg_delivery),
      onTimeRate: times.on_time,
      tipsCents: today._sum.tipCents ?? 0,
    },
    lastWeek: {
      orders: lastWeek._count._all,
      revenueCents: (lastWeek._sum.totalCents ?? 0) - (lastWeek._sum.tipCents ?? 0),
    },
    live: {
      awaitingAcceptance: count(["RECEIVED"]),
      preparing: count(["CONFIRMED", "PREPARING"]),
      ready: count(["READY_FOR_PICKUP", "RIDER_ASSIGNED", "RIDER_TO_RESTAURANT"]),
      outForDelivery: count(["PICKED_UP", "ON_THE_WAY"]),
      escalated,
    },
    riders: { available: ridersBy("AVAILABLE"), busy: ridersBy("BUSY"), offline: ridersBy("OFFLINE") },
    latest: latest.map(toAdminListItem),
    // availableAgainAt null = sold out until someone turns it back on.
    soldOut: soldOut.map((p) => ({
      id: p.id,
      name: p.name,
      availableAgainAt: p.unavailableUntil?.toISOString() ?? null,
    })),
  };
}

export async function getAnalytics(
  range: RangeKey,
  custom: { from?: string; to?: string },
  now = new Date(),
): Promise<AnalyticsDTO> {
  const config = await loadRestaurantConfig();
  const tz = config.timezone;
  const { from, to } = reportRange(range, now, tz, custom);
  const window = Prisma.sql`o."placedAt" >= ${from} AND o."placedAt" < ${to}`;
  const sold = Prisma.sql`o.status::text NOT IN ('PENDING_PAYMENT', 'CANCELLED', 'REFUNDED')`;

  const [
    totals,
    daily,
    hourly,
    weekday,
    top,
    fulfillment,
    payments,
    coupons,
    refunds,
    cancelled,
    customers,
    times,
  ] = await Promise.all([
    db.$queryRaw<{ orders: number; revenue: number; discounts: number; tips: number }[]>`
      SELECT COUNT(*)::int AS orders, COALESCE(SUM(o."totalCents" - o."tipCents"), 0)::int AS revenue,
             COALESCE(SUM(o."discountCents"), 0)::int AS discounts, COALESCE(SUM(o."tipCents"), 0)::int AS tips
      FROM orders o WHERE ${window} AND ${sold}`,
    db.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
      SELECT to_char(timezone(${tz}, o."placedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS orders, COALESCE(SUM(o."totalCents" - o."tipCents"), 0)::int AS revenue
      FROM orders o WHERE ${window} AND ${sold} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ hour: number; orders: number }[]>`
      SELECT EXTRACT(HOUR FROM timezone(${tz}, o."placedAt" AT TIME ZONE 'UTC'))::int AS hour, COUNT(*)::int AS orders
      FROM orders o WHERE ${window} AND ${sold} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ weekday: number; orders: number; revenue: number }[]>`
      SELECT EXTRACT(ISODOW FROM timezone(${tz}, o."placedAt" AT TIME ZONE 'UTC'))::int AS weekday,
             COUNT(*)::int AS orders, COALESCE(SUM(o."totalCents" - o."tipCents"), 0)::int AS revenue
      FROM orders o WHERE ${window} AND ${sold} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ product_id: string | null; name: string; quantity: number; revenue: number }[]>`
      SELECT i."productId" AS product_id, MIN(i.name) AS name, SUM(i.quantity)::int AS quantity, SUM(i."lineTotalCents")::int AS revenue
      FROM order_items i JOIN orders o ON o.id = i."orderId"
      WHERE ${window} AND ${sold}
      GROUP BY i."productId", CASE WHEN i."productId" IS NULL THEN i.name END
      ORDER BY quantity DESC, revenue DESC LIMIT 15`,
    db.$queryRaw<{ type: "DELIVERY" | "PICKUP"; orders: number; revenue: number }[]>`
      SELECT o."fulfillmentType"::text AS type, COUNT(*)::int AS orders, COALESCE(SUM(o."totalCents" - o."tipCents"), 0)::int AS revenue
      FROM orders o WHERE ${window} AND ${sold} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ method: string; orders: number; revenue: number }[]>`
      SELECT CASE WHEN o."paymentMethod" = 'CASH_ON_DELIVERY' THEN 'Contanti'
                  WHEN p.wallet = 'apple_pay' THEN 'Apple Pay'
                  WHEN p.wallet = 'google_pay' THEN 'Google Pay'
                  ELSE 'Carta' END AS method,
             COUNT(*)::int AS orders, COALESCE(SUM(o."totalCents" - o."tipCents"), 0)::int AS revenue
      FROM orders o
      LEFT JOIN LATERAL (SELECT wallet FROM payments WHERE "orderId" = o.id AND status::text IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED') ORDER BY "createdAt" DESC LIMIT 1) p ON true
      WHERE ${window} AND ${sold} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ code: string | null; name: string; redemptions: number; discount: number }[]>`
      SELECT c.code, c.name, COUNT(*)::int AS redemptions, COALESCE(SUM(r."discountCents"), 0)::int AS discount
      FROM coupon_redemptions r JOIN coupons c ON c.id = r."couponId" JOIN orders o ON o.id = r."orderId"
      WHERE ${window} AND r.status::text <> 'RELEASED' GROUP BY c.id ORDER BY redemptions DESC LIMIT 10`,
    db.$queryRaw<{ refunded: number }[]>`
      SELECT COALESCE(SUM(r."amountCents"), 0)::int AS refunded FROM refunds r
      WHERE r."createdAt" >= ${from} AND r."createdAt" < ${to} AND r.status::text = 'SUCCEEDED'`,
    db.order.count({
      where: {
        AND: [REAL_ORDER, { status: { in: ["CANCELLED", "REFUNDED"] } }, { placedAt: { gte: from, lt: to } }],
      },
    }),
    db.$queryRaw<{ customers: number; new_customers: number }[]>`
      WITH buyers AS (
        SELECT DISTINCT lower(o."customerEmail") AS email FROM orders o WHERE ${window} AND ${sold}
      ), firsts AS (
        SELECT lower(o."customerEmail") AS email, MIN(o."placedAt") AS first_at FROM orders o
        WHERE o.status::text NOT IN ('PENDING_PAYMENT', 'CANCELLED', 'REFUNDED') GROUP BY 1
      )
      SELECT (SELECT COUNT(*) FROM buyers)::int AS customers,
             (SELECT COUNT(*) FROM buyers b JOIN firsts f ON f.email = b.email WHERE f.first_at >= ${from})::int AS new_customers`,
    timings(from, to),
  ]);

  const t = totals[0] ?? { orders: 0, revenue: 0, discounts: 0, tips: 0 };
  // Fill missing days so charts show gaps as zero, not as missing points.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days: AnalyticsDTO["daily"] = [];
  for (let d = new Date(from); d < to; d = dayStart(d, tz, 1)) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const row = byDay.get(key);
    days.push({ date: key, orders: row?.orders ?? 0, revenueCents: row?.revenue ?? 0 });
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      orders: t.orders,
      revenueCents: t.revenue,
      averageTicketCents: t.orders ? Math.round(t.revenue / t.orders) : 0,
      customers: customers[0]?.customers ?? 0,
      newCustomers: customers[0]?.new_customers ?? 0,
      discountsCents: t.discounts,
      tipsCents: t.tips,
      cancelled,
      refundedCents: refunds[0]?.refunded ?? 0,
    },
    daily: days,
    hourly: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: hourly.find((h) => h.hour === hour)?.orders ?? 0,
    })),
    weekday: [1, 2, 3, 4, 5, 6, 7].map((w) => {
      const row = weekday.find((x) => x.weekday === w);
      return { weekday: w, orders: row?.orders ?? 0, revenueCents: row?.revenue ?? 0 };
    }),
    topProducts: top.map((p) => ({
      productId: p.product_id,
      name: p.name,
      quantity: p.quantity,
      revenueCents: p.revenue,
    })),
    fulfillment: fulfillment.map((f) => ({ type: f.type, orders: f.orders, revenueCents: f.revenue })),
    payments: payments.map((p) => ({ method: p.method, orders: p.orders, revenueCents: p.revenue })),
    times: {
      avgAcceptMinutes: minutes(times.avg_accept),
      avgPrepMinutes: minutes(times.avg_prep),
      avgDeliveryMinutes: minutes(times.avg_delivery),
      onTimeRate: times.on_time,
    },
    coupons: coupons.map((c) => ({
      code: c.code,
      name: c.name,
      redemptions: c.redemptions,
      discountCents: c.discount,
    })),
  };
}
