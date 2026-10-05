"use client";

import { ORDER_STATUS_LABELS, formatEuro, isActive } from "@dimsum/domain";
import type { OrderStatus, OrderSummaryDTO } from "@dimsum/types";
import { ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRestaurant } from "@/components/shop/restaurant-context";
import { FoodImage } from "@/components/shop/food-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatOrderDate } from "@/lib/dates";

function statusTone(status: OrderStatus) {
  if (status === "DELIVERED") return "success" as const;
  if (status === "CANCELLED" || status === "REFUNDED") return "neutral" as const;
  return "brand" as const;
}

/** Order in "I miei ordini": active orders lead to live tracking, past ones offer "Riordina". */
export function OrderCard({
  order,
  onReorder,
  reordering,
}: {
  order: OrderSummaryDTO;
  onReorder?: (orderId: string) => void;
  reordering?: boolean;
}) {
  const { timezone } = useRestaurant();
  const active = isActive(order.status);
  const label =
    order.status === "DELIVERED" && order.fulfillmentType === "PICKUP"
      ? "Ritirato"
      : ORDER_STATUS_LABELS[order.status];

  return (
    <article className="relative flex gap-4 rounded-2xl bg-surface p-4 shadow-xs ring-1 ring-line">
      <FoodImage image={order.previewImage} sizes="72px" rounded="rounded-xl" className="size-18 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold">
              <Link
                href={`/order/${order.publicId}`}
                className="after:absolute after:inset-0 after:rounded-2xl after:content-['']"
              >
                #{order.number}
              </Link>
            </h3>
            <p className="text-caption text-fg-muted">
              {formatOrderDate(order.placedAt, timezone)} ·{" "}
              {order.fulfillmentType === "DELIVERY" ? "Consegna" : "Ritiro"}
            </p>
          </div>
          <p className="font-bold tabular-nums">{formatEuro(order.totalCents)}</p>
        </div>
        <p className="mt-1.5 line-clamp-2 text-body-sm text-fg-muted">{order.itemsPreview}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Badge tone={statusTone(order.status)} size="md">
            {active ? <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> : null}
            {label}
          </Badge>
          {active ? (
            <span className="flex items-center gap-1 text-body-sm font-semibold text-brand-ink">
              Segui <ChevronRight className="size-4" aria-hidden />
            </span>
          ) : onReorder ? (
            <Button
              size="sm"
              variant="secondary"
              className="relative z-10"
              loading={reordering}
              onClick={() => onReorder(order.id)}
            >
              <RotateCcw className="size-4" /> Riordina
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
