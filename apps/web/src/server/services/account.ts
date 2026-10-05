import "server-only";
import { randomUUID } from "node:crypto";
import {
  firstNameOf,
  isAvailableNow,
  resolveVariant,
  unitPrice,
  validateModifierSelection,
} from "@dimsum/domain";
import {
  CONSENT_TYPES,
  type CartLineInput,
  type ConsentType,
  type MeDTO,
  type OrderStatus,
  type OrderSummaryDTO,
  type Paginated,
  type SavedAddressDTO,
} from "@dimsum/types";
import type { accountCartSync, savedAddressInput, updateProfile } from "@dimsum/validation";
import type { z } from "zod";
import { db, type Prisma } from "../db";
import { AppError, notFound } from "../errors";
import { loadProductsForPricing } from "./catalog";
import { currentConsents, recordConsents } from "./consents";
import { orderInclude, toSummaryDTO } from "./orders/queries";
import { toPriced } from "./quote";

/* ------------------------------------------------------------------ profile */

export async function getMe(userId: string): Promise<MeDTO> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { customerProfile: { select: { birthDate: true } } },
  });
  if (!user || user.deletedAt) throw new AppError("UNAUTHENTICATED");
  const latest = await currentConsents(user.id, user.email);
  const consents = Object.fromEntries(CONSENT_TYPES.map((t) => [t, latest[t] ?? false])) as Record<
    ConsentType,
    boolean
  >;
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    firstName: firstNameOf(user.name),
    phone: user.phone,
    image: user.image,
    role: user.role,
    birthDate: user.customerProfile?.birthDate?.toISOString().slice(0, 10) ?? null,
    createdAt: user.createdAt.toISOString(),
    consents,
  };
}

/** How the customer signs in: "credential" (password), "google", "apple". */
export async function signInMethods(userId: string): Promise<string[]> {
  const rows = await db.account.findMany({ where: { userId }, select: { providerId: true } });
  return rows.map((r) => r.providerId);
}

export async function updateMe(userId: string, input: z.output<typeof updateProfile>): Promise<MeDTO> {
  let birthDate: Date | null = null;
  if (input.birthDate) {
    birthDate = new Date(`${input.birthDate}T00:00:00Z`);
    const year = birthDate.getUTCFullYear();
    if (Number.isNaN(birthDate.getTime()) || year < 1900 || birthDate > new Date()) {
      throw new AppError("VALIDATION_FAILED", "Data di nascita non valida.", {
        fieldErrors: { birthDate: ["Data di nascita non valida."] },
      });
    }
  }
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { name: input.name, phone: input.phone } }),
    db.customerProfile.upsert({ where: { userId }, create: { userId, birthDate }, update: { birthDate } }),
  ]);
  return getMe(userId);
}

export async function updateMyConsents(
  userId: string,
  consents: { type: ConsentType; granted: boolean }[],
  ctx: { ip: string; userAgent: string | null; source: string },
): Promise<MeDTO> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  await recordConsents(consents, {
    userId,
    email: user.email,
    source: ctx.source,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return getMe(userId);
}

/* ------------------------------------------------------------------ cart */

export async function getAccountCart(
  userId: string,
): Promise<{ lines: CartLineInput[]; couponCode: string | null }> {
  const cart = await db.cart.findUnique({
    where: { userId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  return {
    couponCode: cart?.couponCode ?? null,
    lines:
      cart?.items.map((i) => ({
        lineId: i.lineId,
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
        modifiers: i.modifiers as unknown as CartLineInput["modifiers"],
        notes: i.notes,
      })) ?? [],
  };
}

/** Mirrors the device cart on the account, so it follows the customer on every device. */
export async function saveAccountCart(
  userId: string,
  input: z.output<typeof accountCartSync>,
): Promise<void> {
  const lines = [...new Map(input.lines.map((l) => [l.lineId, l])).values()];
  await db.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId },
      create: { userId, couponCode: input.couponCode },
      update: { couponCode: input.couponCode },
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    if (lines.length) {
      await tx.cartItem.createMany({
        data: lines.map((l, position) => ({
          cartId: cart.id,
          lineId: l.lineId,
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          modifiers: l.modifiers,
          notes: l.notes,
          position,
        })),
      });
    }
  });
}

/* ------------------------------------------------------------------ orders */

const ACTIVE_STATUSES: OrderStatus[] = [
  "PAID",
  "RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "RIDER_ASSIGNED",
  "RIDER_TO_RESTAURANT",
  "PICKED_UP",
  "ON_THE_WAY",
];

export async function listMyOrders(
  userId: string,
  filter: { status: "active" | "history" | "all"; cursor?: string; limit?: number },
): Promise<Paginated<OrderSummaryDTO>> {
  const limit = Math.min(filter.limit ?? 20, 50);
  const where: Prisma.OrderWhereInput = {
    userId,
    // Abandoned online payments never reached the kitchen: they are not real orders for the customer.
    status:
      filter.status === "active"
        ? { in: ACTIVE_STATUSES }
        : filter.status === "history"
          ? { in: ["DELIVERED", "CANCELLED", "REFUNDED"] }
          : { not: "PENDING_PAYMENT" },
    NOT: { status: "CANCELLED", receivedAt: null },
  };
  const rows = await db.order.findMany({
    where,
    include: orderInclude,
    orderBy: [{ placedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(toSummaryDTO),
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}

/**
 * Rebuilds the cart lines of a past order against today's menu. Products that are gone, sold
 * out or whose options changed are reported instead of silently dropped or re-priced.
 */
export async function reorder(
  userId: string,
  orderId: string,
): Promise<{ lines: CartLineInput[]; unavailable: string[]; changedPrices: string[] }> {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: { items: { include: { modifiers: true }, orderBy: { position: "asc" } } },
  });
  if (!order) throw notFound("Ordine");
  const rows = await loadProductsForPricing(order.items.flatMap((i) => (i.productId ? [i.productId] : [])));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  const lines: CartLineInput[] = [];
  const unavailable: string[] = [];
  const changedPrices: string[] = [];

  for (const item of order.items) {
    const row = item.productId ? byId.get(item.productId) : undefined;
    if (
      !row ||
      !row.isVisible ||
      !isAvailableNow({ isAvailable: row.isAvailable, unavailableUntil: row.unavailableUntil }, now)
    ) {
      unavailable.push(item.name);
      continue;
    }
    const product = toPriced(row);
    const modifiers = item.modifiers.flatMap((m) =>
      m.modifierId ? [{ modifierId: m.modifierId, quantity: m.quantity }] : [],
    );
    const variant = resolveVariant(product, item.variantId);
    const selection = validateModifierSelection(product, modifiers);
    if (!variant.ok || !selection.ok || modifiers.length !== item.modifiers.length) {
      unavailable.push(item.name);
      continue;
    }
    if (unitPrice(product, selection.resolved, variant.variant) !== item.unitPriceCents)
      changedPrices.push(row.name);
    lines.push({
      lineId: randomUUID(),
      productId: row.id,
      variantId: variant.variant?.id ?? null,
      quantity: Math.min(item.quantity, product.maxQuantityPerLine),
      modifiers,
      notes: item.notes,
    });
  }
  return { lines, unavailable, changedPrices };
}

/* ------------------------------------------------------------------ addresses */

const MAX_ADDRESSES = 20;
type AddressRow = Prisma.AddressGetPayload<object>;

export function toSavedAddressDTO(a: AddressRow): SavedAddressDTO {
  return {
    id: a.id,
    label: a.label,
    isDefault: a.isDefault,
    street: a.street,
    streetNumber: a.streetNumber,
    postalCode: a.postalCode,
    city: a.city,
    province: a.province,
    country: a.country,
    formatted: a.formatted,
    location: { lat: a.lat, lng: a.lng },
    placeId: a.placeId,
    precision: a.precision as SavedAddressDTO["precision"],
    staircase: a.staircase,
    floor: a.floor,
    apartment: a.apartment,
    intercom: a.intercom,
    riderNotes: a.riderNotes,
  };
}

export async function listAddresses(userId: string): Promise<SavedAddressDTO[]> {
  const rows = await db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return rows.map(toSavedAddressDTO);
}

function addressData(input: z.output<typeof savedAddressInput>) {
  return {
    label: input.label,
    street: input.street,
    streetNumber: input.streetNumber,
    postalCode: input.postalCode,
    city: input.city,
    province: input.province,
    country: input.country,
    formatted: input.formatted,
    lat: input.location.lat,
    lng: input.location.lng,
    placeId: input.placeId,
    precision: input.precision,
    staircase: input.staircase,
    floor: input.floor,
    apartment: input.apartment,
    intercom: input.intercom,
    riderNotes: input.riderNotes,
  };
}

export async function createAddress(
  userId: string,
  input: z.output<typeof savedAddressInput>,
): Promise<SavedAddressDTO> {
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES)
      throw new AppError("CONFLICT", `Puoi salvare al massimo ${MAX_ADDRESSES} indirizzi.`);
    const isDefault = input.isDefault || count === 0;
    if (isDefault)
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return toSavedAddressDTO(await tx.address.create({ data: { userId, isDefault, ...addressData(input) } }));
  });
}

export async function updateAddress(
  userId: string,
  id: string,
  input: z.output<typeof savedAddressInput>,
): Promise<SavedAddressDTO> {
  return db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId } });
    if (!existing) throw notFound("Indirizzo");
    // The default can be moved to another address, not removed: one address is always the default.
    const isDefault = input.isDefault || existing.isDefault;
    if (input.isDefault && !existing.isDefault)
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return toSavedAddressDTO(
      await tx.address.update({ where: { id }, data: { isDefault, ...addressData(input) } }),
    );
  });
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId } });
    if (!existing) throw notFound("Indirizzo");
    await tx.address.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

/* ------------------------------------------------------------------ favorites */

export async function listFavorites(userId: string): Promise<string[]> {
  const rows = await db.favorite.findMany({
    where: { userId, product: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}

export async function addFavorite(userId: string, productId: string): Promise<void> {
  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw notFound("Prodotto");
  await db.favorite.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
}

export async function removeFavorite(userId: string, productId: string): Promise<void> {
  await db.favorite.deleteMany({ where: { userId, productId } });
}

/* ------------------------------------------------------------------ GDPR */

/** Everything we store about the customer, in a portable format (GDPR art. 15 and 20). */
export async function exportMyData(userId: string): Promise<Record<string, unknown>> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      customerProfile: true,
      addresses: true,
      favorites: { include: { product: { select: { name: true } } } },
      consents: { orderBy: { createdAt: "asc" } },
      loyaltyAccount: { include: { transactions: { orderBy: { createdAt: "asc" } } } },
      notifications: { orderBy: { createdAt: "asc" } },
      supportTickets: { include: { messages: { orderBy: { createdAt: "asc" } } } },
      accounts: { select: { providerId: true, createdAt: true } },
    },
  });
  const orders = await db.order.findMany({
    where: { userId },
    orderBy: { placedAt: "asc" },
    include: {
      items: { include: { modifiers: true } },
      payments: {
        select: {
          provider: true,
          status: true,
          amountCents: true,
          cardBrand: true,
          cardLast4: true,
          createdAt: true,
        },
      },
    },
  });
  return {
    exportedAt: new Date().toISOString(),
    profile: {
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      phone: user.phone,
      birthDate: user.customerProfile?.birthDate ?? null,
      createdAt: user.createdAt,
      signInMethods: user.accounts.map((a) => ({ provider: a.providerId, since: a.createdAt })),
    },
    addresses: user.addresses.map((a) => ({
      label: a.label,
      address: a.formatted,
      staircase: a.staircase,
      floor: a.floor,
      apartment: a.apartment,
      intercom: a.intercom,
      riderNotes: a.riderNotes,
      isDefault: a.isDefault,
      createdAt: a.createdAt,
    })),
    favorites: user.favorites.map((f) => ({ product: f.product.name, since: f.createdAt })),
    orders: orders.map((o) => ({
      number: o.displayNumber,
      placedAt: o.placedAt,
      status: o.status,
      fulfillmentType: o.fulfillmentType,
      customer: { name: o.customerName, email: o.customerEmail, phone: o.customerPhone },
      address: o.addressFormatted,
      items: o.items.map((i) => ({
        name: i.name,
        variant: i.variantName,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        options: i.modifiers.map((m) => m.name),
        notes: i.notes,
      })),
      totals: {
        subtotalCents: o.subtotalCents,
        discountCents: o.discountCents,
        deliveryFeeCents: o.deliveryFeeCents,
        tipCents: o.tipCents,
        totalCents: o.totalCents,
      },
      payments: o.payments,
    })),
    consents: user.consents.map((c) => ({
      type: c.type,
      granted: c.granted,
      source: c.source,
      policyVersion: c.policyVersion,
      at: c.createdAt,
    })),
    loyalty: user.loyaltyAccount
      ? {
          points: user.loyaltyAccount.points,
          transactions: user.loyaltyAccount.transactions.map((t) => ({
            type: t.type,
            points: t.points,
            description: t.description,
            at: t.createdAt,
          })),
        }
      : null,
    notifications: user.notifications.map((n) => ({
      title: n.title,
      body: n.body,
      at: n.createdAt,
      readAt: n.readAt,
    })),
    supportRequests: user.supportTickets.map((t) => ({
      reference: t.reference,
      subject: t.subject,
      status: t.status,
      messages: t.messages.map((m) => ({ fromStaff: m.fromStaff, body: m.body, at: m.createdAt })),
    })),
  };
}

/**
 * Account deletion (GDPR art. 17). Personal data is erased; orders stay for accounting and tax
 * obligations, stripped of contact details and delivery notes.
 */
export async function deleteMyAccount(
  userId: string,
  ctx: { ip: string; userAgent: string | null },
): Promise<void> {
  const active = await db.order.count({ where: { userId, status: { in: ACTIVE_STATUSES } } });
  if (active > 0)
    throw new AppError("CONFLICT", "Hai un ordine in corso: potrai eliminare l'account dopo la consegna.");
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (user.role !== "CUSTOMER")
    throw new AppError("FORBIDDEN", "Gli account dello staff si gestiscono dal pannello amministrazione.");
  const placeholderEmail = `eliminato-${userId}@account.invalid`;

  await db.$transaction(async (tx) => {
    await recordConsents(
      [
        { type: "MARKETING_EMAIL", granted: false },
        { type: "MARKETING_PUSH", granted: false },
        { type: "PERSONALIZATION", granted: false },
      ],
      { userId, source: "account_deleted", ip: ctx.ip, userAgent: ctx.userAgent },
      tx,
    );
    await tx.consentRecord.updateMany({
      where: { OR: [{ userId }, { email: user.email }] },
      data: { email: null, userAgent: null },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.address.deleteMany({ where: { userId } });
    await tx.favorite.deleteMany({ where: { userId } });
    await tx.cart.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.deviceToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.loyaltyAccount.deleteMany({ where: { userId } });
    await tx.customerProfile.deleteMany({ where: { userId } });
    await tx.supportTicket.updateMany({
      where: { userId },
      data: { name: "Cliente", email: placeholderEmail, phone: null },
    });
    await tx.order.updateMany({
      where: { userId },
      data: {
        customerName: "Cliente",
        customerEmail: placeholderEmail,
        customerPhone: null,
        staircase: null,
        floor: null,
        apartment: null,
        intercom: null,
        riderNotes: null,
        kitchenNotes: null,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Account eliminato",
        email: placeholderEmail,
        emailVerified: false,
        image: null,
        phone: null,
        deletedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: userId,
        actorRole: "CUSTOMER",
        action: "account.deleted",
        entityType: "User",
        entityId: userId,
      },
    });
  });
}
