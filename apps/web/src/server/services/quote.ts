import "server-only";
import {
  computeTotals,
  deliveryFeeFor,
  getAvailability,
  isAvailableNow,
  resolveVariant,
  unitPrice,
  validateModifierSelection,
  validateRequestedSlot,
  type CouponChoice,
  type DeliveryZoneRule,
  type PricedProduct,
  type RouteInfo,
  type Totals,
} from "@dimsum/domain";
import type {
  Allergen,
  CartIssueDTO,
  CartQuoteDTO,
  CheckoutBlocker,
  DeliveryQuoteDTO,
  FulfillmentType,
  ImageDTO,
} from "@dimsum/types";
import type { CartLine } from "@dimsum/validation";
import { loadProductsForPricing, toImageDTO, type PricingProductRow } from "./catalog";
import { decideCoupon, type CouponCustomer } from "./coupons";
import { resolveDelivery } from "./delivery";
import { toScheduleConfig, type RestaurantConfig } from "./restaurant";

export interface PricedLine {
  lineId: string;
  productId: string;
  categoryId: string;
  variantId: string | null;
  variantName: string | null;
  name: string;
  nameZh: string | null;
  posCode: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  vatRateBps: number;
  excludedFromDiscounts: boolean;
  notes: string | null;
  allergens: Allergen[];
  modifiers: {
    modifierId: string;
    groupName: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }[];
  image: ImageDTO | null;
}

export interface QuoteRequest {
  lines: CartLine[];
  fulfillmentType: FulfillmentType;
  delivery: {
    location: { lat: number; lng: number };
    precision: "rooftop" | "street" | "approximate";
  } | null;
  couponCode: string | null;
  tipCents: number;
  scheduledFor: string | null;
}

export interface QuoteResult {
  dto: CartQuoteDTO;
  lines: PricedLine[];
  coupon: CouponChoice | null;
  zone: DeliveryZoneRule | null;
  route: RouteInfo | null;
  totals: Totals;
  scheduledFor: Date | null;
}

export function toPriced(p: PricingProductRow): PricedProduct {
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    priceCents: p.priceCents,
    vatRateBps: p.vatRateBps,
    isAvailable: p.isAvailable,
    excludedFromDiscounts: p.excludedFromDiscounts,
    maxQuantityPerLine: p.maxQuantityPerLine,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      priceCents: v.priceCents,
      isAvailable: v.isAvailable,
    })),
    modifierGroups: p.modifierGroups
      .filter((pg) => pg.group.isActive)
      .map(({ group }) => ({
        id: group.id,
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        maxTotalQuantity: group.maxTotalQuantity,
        options: group.modifiers.map((m) => ({
          id: m.id,
          groupId: group.id,
          name: m.name,
          priceDeltaCents: m.priceDeltaCents,
          isAvailable: m.isAvailable,
          maxQuantity: m.maxQuantity,
        })),
      })),
  };
}

/**
 * Prices a cart against the CURRENT catalog and configuration. The client never decides a price:
 * the quote reports every difference (price changed, sold out, invalid options) so the UI can
 * explain it, and checkout re-runs the very same function inside its transaction.
 */
export async function quoteCart(
  input: QuoteRequest,
  ctx: { config: RestaurantConfig; now: Date; customer: CouponCustomer },
): Promise<QuoteResult> {
  const { config, now } = ctx;
  const issues: CartIssueDTO[] = [];
  const blockers = new Set<CheckoutBlocker>();
  const rows = await loadProductsForPricing(input.lines.map((l) => l.productId));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const priced: PricedLine[] = [];
  const display: CartQuoteDTO["lines"] = [];
  for (const line of input.lines) {
    const row = byId.get(line.productId);
    if (!row || !row.isVisible) {
      issues.push({
        lineId: line.lineId,
        productId: line.productId,
        code: "REMOVED",
        message: "Un prodotto non è più nel menu ed è stato tolto dal carrello.",
      });
      continue;
    }
    const product = toPriced(row);
    let quantity = line.quantity;
    if (quantity > product.maxQuantityPerLine) {
      quantity = product.maxQuantityPerLine;
      issues.push({
        lineId: line.lineId,
        productId: row.id,
        code: "QUANTITY_LIMIT",
        message: `Puoi ordinare al massimo ${quantity} × ${row.name}.`,
      });
    }
    const available = isAvailableNow(
      { isAvailable: row.isAvailable, unavailableUntil: row.unavailableUntil },
      now,
    );
    const variant = resolveVariant(product, line.variantId);
    const mods = validateModifierSelection(product, line.modifiers);
    const unit = unitPrice(product, mods.resolved, variant.ok ? variant.variant : null);
    const lineTotal = unit * quantity;
    let lineOk = available;

    if (!available) {
      issues.push({
        lineId: line.lineId,
        productId: row.id,
        code: "UNAVAILABLE",
        message: `${row.name} è appena andato esaurito.`,
      });
    }
    if (!variant.ok) {
      lineOk = false;
      issues.push({
        lineId: line.lineId,
        productId: row.id,
        code: "INVALID_VARIANT",
        message: `Scegli di nuovo la variante di ${row.name}.`,
      });
    }
    if (!mods.ok) {
      lineOk = false;
      const unavailableMod = mods.errors.some(
        (e) => e.code === "MODIFIER_UNAVAILABLE" || e.code === "UNKNOWN_MODIFIER",
      );
      issues.push({
        lineId: line.lineId,
        productId: row.id,
        code: unavailableMod ? "MODIFIER_UNAVAILABLE" : "INVALID_MODIFIERS",
        message: unavailableMod
          ? `Un'aggiunta di ${row.name} non è più disponibile.`
          : `Rivedi le opzioni di ${row.name}.`,
      });
    }
    if (line.expectedUnitPriceCents !== undefined && line.expectedUnitPriceCents !== unit && lineOk) {
      issues.push({
        lineId: line.lineId,
        productId: row.id,
        code: "PRICE_CHANGED",
        message: `Il prezzo di ${row.name} è stato aggiornato.`,
        previousPriceCents: line.expectedUnitPriceCents,
        currentPriceCents: unit,
      });
    }

    const image = toImageDTO(row.images[0]);
    const variantName = variant.ok && variant.variant ? variant.variant.name : null;
    display.push({
      lineId: line.lineId,
      productId: row.id,
      variantId: variant.ok ? (variant.variant?.id ?? null) : null,
      variantName,
      name: row.name,
      image,
      quantity,
      unitPriceCents: unit,
      lineTotalCents: lineTotal,
      modifiers: mods.resolved.map((r) => ({
        modifierId: r.modifier.id,
        groupName: r.group.name,
        name: r.modifier.name,
        quantity: r.quantity,
        unitPriceCents: r.modifier.priceDeltaCents,
      })),
      notes: line.notes,
      isAvailable: lineOk,
    });
    if (!lineOk) continue;
    priced.push({
      lineId: line.lineId,
      productId: row.id,
      categoryId: row.categoryId,
      variantId: variant.ok ? (variant.variant?.id ?? null) : null,
      variantName,
      name: row.name,
      nameZh: row.nameZh,
      posCode: row.posCode,
      quantity,
      unitPriceCents: unit,
      lineTotalCents: lineTotal,
      vatRateBps: row.vatRateBps,
      excludedFromDiscounts: row.excludedFromDiscounts,
      notes: line.notes,
      allergens: row.allergens.map((a) => a.allergen),
      modifiers: mods.resolved.map((r) => ({
        modifierId: r.modifier.id,
        groupName: r.group.name,
        name: r.modifier.name,
        quantity: r.quantity,
        unitPriceCents: r.modifier.priceDeltaCents,
      })),
      image,
    });
  }

  if (input.lines.length === 0) blockers.add("EMPTY_CART");
  if (
    issues.some(
      (i) =>
        i.code === "UNAVAILABLE" ||
        i.code === "REMOVED" ||
        i.code === "INVALID_MODIFIERS" ||
        i.code === "INVALID_VARIANT" ||
        i.code === "MODIFIER_UNAVAILABLE",
    )
  ) {
    blockers.add("CART_ISSUES");
  }

  const subtotal = priced.reduce((s, l) => s + l.lineTotalCents, 0);

  // Service availability (ASAP or the requested slot).
  const schedule = toScheduleConfig(config);
  let scheduledFor: Date | null = null;
  const enabled = input.fulfillmentType === "DELIVERY" ? config.deliveryEnabled : config.pickupEnabled;
  if (!enabled) blockers.add("FULFILLMENT_UNAVAILABLE");
  if (input.scheduledFor) {
    const slot = validateRequestedSlot(schedule, input.fulfillmentType, new Date(input.scheduledFor), now);
    if (slot.ok) scheduledFor = slot.slot.start;
    else blockers.add(slot.reason === "PAUSED" ? "ORDERS_PAUSED" : "SLOT_UNAVAILABLE");
  } else {
    const a = getAvailability(schedule, input.fulfillmentType, now);
    if (!a.available) blockers.add(a.reason === "PAUSED" ? "ORDERS_PAUSED" : "RESTAURANT_CLOSED");
  }

  // Delivery zone, fee and minimum.
  let delivery: DeliveryQuoteDTO | null = null;
  let zone: DeliveryZoneRule | null = null;
  let route: RouteInfo | null = null;
  let deliveryFee = 0;
  let minimum = 0;
  let freeShortfall: number | null = null;
  if (input.fulfillmentType === "DELIVERY") {
    if (!input.delivery) {
      blockers.add("ADDRESS_REQUIRED");
    } else {
      const resolution = await resolveDelivery(input.delivery.location, input.delivery.precision, { config });
      delivery = resolution.quote;
      zone = resolution.zone;
      route = resolution.route;
      if (!zone) blockers.add("OUT_OF_ZONE");
      else {
        deliveryFee = deliveryFeeFor(zone, subtotal);
        minimum = zone.minimumOrderCents;
        if (zone.freeDeliveryThresholdCents !== null && deliveryFee > 0)
          freeShortfall = zone.freeDeliveryThresholdCents - subtotal;
      }
    }
  }
  const shortfall = Math.max(0, minimum - subtotal);
  if (shortfall > 0) blockers.add("BELOW_MINIMUM");

  // Promotions.
  const decision = await decideCoupon({
    code: input.couponCode,
    customer: ctx.customer,
    context: {
      now,
      fulfillmentType: input.fulfillmentType,
      deliveryFeeCents: deliveryFee,
      lines: priced.map((l) => ({
        productId: l.productId,
        categoryId: l.categoryId,
        lineTotalCents: l.lineTotalCents,
        excludedFromDiscounts: l.excludedFromDiscounts,
      })),
    },
  });

  const tip = input.fulfillmentType === "DELIVERY" && config.tipsEnabled ? input.tipCents : 0;
  const totals = computeTotals({
    lines: priced.map((l) => ({
      lineTotalCents: l.lineTotalCents,
      vatRateBps: l.vatRateBps,
      discountEligible: !l.excludedFromDiscounts,
    })),
    itemsDiscountCents: decision.choice?.evaluation.itemsDiscountCents ?? 0,
    deliveryFeeCents: deliveryFee,
    deliveryDiscountCents: decision.choice?.evaluation.deliveryDiscountCents ?? 0,
    deliveryVatRateBps: config.deliveryFeeVatRateBps,
    serviceFeeCents: priced.length ? config.serviceFeeCents : 0,
    serviceFeeVatRateBps: config.serviceFeeVatRateBps,
    tipCents: tip,
  });

  const dto: CartQuoteDTO = {
    lines: display,
    issues,
    totals: {
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      deliveryFeeCents: totals.deliveryFeeCents,
      serviceFeeCents: totals.serviceFeeCents,
      tipCents: totals.tipCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
    },
    coupon: decision.applied,
    couponError: decision.error,
    delivery,
    minimumOrderCents: minimum,
    minimumOrderShortfallCents: shortfall,
    freeDeliveryShortfallCents: freeShortfall,
    blockers: [...blockers],
    canCheckout: blockers.size === 0,
    quotedAt: now.toISOString(),
  };

  return { dto, lines: priced, coupon: decision.choice, zone, route, totals, scheduledFor };
}
