import "server-only";
import type { OrderSummaryDTO, OrderTrackingDTO } from "@dimsum/types";
import { cookies } from "next/headers";
import { db } from "../../db";
import { signValue, verifySignedValue } from "../../ids";
import { env } from "../../env";
import { getRestaurantConfig } from "../restaurant";
import { findOrderByPublicId, orderInclude, toSummaryDTO, toTrackingDTO } from "./queries";

export async function getTracking(publicId: string, now = new Date()): Promise<OrderTrackingDTO | null> {
  const [order, config] = await Promise.all([findOrderByPublicId(publicId), getRestaurantConfig()]);
  if (!order) return null;
  return toTrackingDTO(
    order,
    {
      name: config.name,
      location: config.location,
      addressLine: config.address.formatted,
      phone: config.phone,
      customerCancelWindowMinutes: config.customerCancelWindowMinutes,
    },
    now,
  );
}

const RECENT_COOKIE = "dimsum.recent_orders";

/** Orders placed from this browser (signed, httpOnly): proves possession when claiming a guest order. */
export async function rememberPlacedOrder(publicId: string): Promise<void> {
  const jar = await cookies();
  const current = verifySignedValue(jar.get(RECENT_COOKIE)?.value)?.split(",").filter(Boolean) ?? [];
  const next = [publicId, ...current.filter((id) => id !== publicId)].slice(0, 10).join(",");
  jar.set(RECENT_COOKIE, signValue(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function placedFromThisBrowser(publicId: string): Promise<boolean> {
  const jar = await cookies();
  const list = verifySignedValue(jar.get(RECENT_COOKIE)?.value)?.split(",") ?? [];
  return list.includes(publicId);
}

/** Guest view of "I miei ordini": the orders placed from this browser (newest first). */
export async function recentOrdersFromThisBrowser(): Promise<OrderSummaryDTO[]> {
  const jar = await cookies();
  const ids = verifySignedValue(jar.get(RECENT_COOKIE)?.value)?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) return [];
  const rows = await db.order.findMany({
    where: {
      publicId: { in: ids },
      NOT: [{ status: "PENDING_PAYMENT" }, { status: "CANCELLED", receivedAt: null }],
    },
    include: orderInclude,
    orderBy: { placedAt: "desc" },
  });
  return rows.map(toSummaryDTO);
}
