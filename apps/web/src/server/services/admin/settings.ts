import "server-only";
import type { AdminHoursDTO, AdminZoneDTO } from "@dimsum/types";
import type {
  closureInput,
  deliveryZoneInput,
  openingHoursInput,
  pauseOrdersInput,
  settingsInput,
} from "@dimsum/validation";
import type { z } from "zod";
import type { Viewer } from "../../auth/session";
import { audit } from "../../audit";
import { expireTags } from "../../cache";
import { db, Prisma } from "../../db";
import { AppError } from "../../errors";
import { publish } from "../../realtime/bus";
import { ZONES_TAG } from "../delivery";
import { SETTINGS_TAG, computeServiceStatus, loadLiveLoad, loadRestaurantConfig } from "../restaurant";

/** Settings changed: expire caches and push the new opening state to every open page. */
async function settingsChanged(): Promise<void> {
  expireTags(SETTINGS_TAG);
  const [config, load] = await Promise.all([loadRestaurantConfig(), loadLiveLoad()]);
  const status = computeServiceStatus(config, load, new Date());
  await publish(["catalog", "kitchen"], {
    type: "restaurant.status",
    acceptingOrders: status.acceptingOrders,
    isPaused: status.isPaused,
  });
}

export type SettingsForm = z.output<typeof settingsInput> & {
  timezone: string;
  ordersPaused: boolean;
  pausedUntil: string | null;
  pauseReason: string | null;
};

/** Settings in the exact shape edited by "Impostazioni" (flat address, current pause state). */
export async function getSettings(): Promise<SettingsForm> {
  const c = await loadRestaurantConfig();
  return {
    name: c.name,
    tagline: c.tagline,
    legalName: c.legalName,
    vatNumber: c.vatNumber,
    phone: c.phone,
    email: c.email,
    supportEmail: c.supportEmail,
    street: c.address.street,
    streetNumber: c.address.streetNumber,
    postalCode: c.address.postalCode,
    city: c.address.city,
    province: c.address.province,
    formattedAddress: c.address.formatted,
    location: c.location,
    googleReviewUrl: c.googleReviewUrl,
    instagramUrl: c.instagramUrl,
    facebookUrl: c.facebookUrl,
    orderNumberPrefix: c.orderNumberPrefix,
    deliveryEnabled: c.deliveryEnabled,
    pickupEnabled: c.pickupEnabled,
    autoAcceptOrders: c.autoAcceptOrders,
    acceptanceEscalationMinutes: c.acceptanceEscalationMinutes,
    defaultPrepMinutes: c.defaultPrepMinutes,
    prepTimeOptions: c.prepTimeOptions,
    schedulingEnabled: c.schedulingEnabled,
    slotIntervalMinutes: c.slotIntervalMinutes as SettingsForm["slotIntervalMinutes"],
    deliveryLeadMinutes: c.deliveryLeadMinutes,
    pickupLeadMinutes: c.pickupLeadMinutes,
    maxScheduleDays: c.maxScheduleDays,
    lastOrderBufferMinutes: c.lastOrderBufferMinutes,
    maxRouteDistanceMeters: c.maxRouteDistanceMeters,
    maxTravelSeconds: c.maxTravelSeconds,
    customerCancelWindowMinutes: c.customerCancelWindowMinutes,
    onlinePaymentsEnabled: c.onlinePaymentsEnabled,
    cashOnDeliveryEnabled: c.cashOnDeliveryEnabled,
    cashOnPickupEnabled: c.cashOnPickupEnabled,
    tipsEnabled: c.tipsEnabled,
    tipOptionsCents: c.tipOptionsCents,
    serviceFeeCents: c.serviceFeeCents,
    phoneRequiredForDelivery: c.phoneRequiredForDelivery,
    phoneRequiredForPickup: c.phoneRequiredForPickup,
    newOrderSoundEnabled: c.newOrderSoundEnabled,
    newOrderSound: c.newOrderSound as SettingsForm["newOrderSound"],
    timezone: c.timezone,
    ordersPaused: c.ordersPaused,
    pausedUntil: c.pausedUntil,
    pauseReason: c.pauseReason,
  };
}

export async function updateSettings(
  input: z.output<typeof settingsInput>,
  actor: Viewer,
): Promise<SettingsForm> {
  if (!input.deliveryEnabled && !input.pickupEnabled) {
    throw new AppError(
      "VALIDATION_FAILED",
      'Lascia attiva almeno la consegna o il ritiro (per fermare gli ordini usa "Blocca ordini").',
    );
  }
  if (!input.onlinePaymentsEnabled && !input.cashOnDeliveryEnabled && !input.cashOnPickupEnabled) {
    throw new AppError("VALIDATION_FAILED", "Serve almeno un metodo di pagamento attivo.");
  }
  const { location, ...rest } = input;
  await db.$transaction(async (tx) => {
    const before = await tx.restaurantSettings.findUniqueOrThrow({ where: { id: "default" } });
    const data: Prisma.RestaurantSettingsUpdateInput = {
      ...rest,
      lat: location.lat,
      lng: location.lng,
      prepTimeOptions: [...new Set(input.prepTimeOptions)].sort((a, b) => a - b),
      tipOptionsCents: [...new Set(input.tipOptionsCents)].sort((a, b) => a - b),
    };
    await tx.restaurantSettings.update({ where: { id: "default" }, data });
    await audit(
      {
        actor,
        action: "settings.updated",
        entityType: "RestaurantSettings",
        entityId: "default",
        before,
        after: input,
      },
      tx,
    );
  });
  await settingsChanged();
  return getSettings();
}

/** "Blocca ordini": stops new orders now, optionally for N minutes; orders in progress continue. */
export async function setOrdersPaused(
  input: z.output<typeof pauseOrdersInput>,
  actor: Viewer,
): Promise<void> {
  const pausedUntil = input.paused && input.minutes ? new Date(Date.now() + input.minutes * 60_000) : null;
  await db.$transaction(async (tx) => {
    await tx.restaurantSettings.update({
      where: { id: "default" },
      data: { ordersPaused: input.paused, pausedUntil, pauseReason: input.paused ? input.reason : null },
    });
    await audit(
      {
        actor,
        action: input.paused ? "orders.paused" : "orders.resumed",
        entityType: "RestaurantSettings",
        entityId: "default",
        after: { pausedUntil, reason: input.reason },
      },
      tx,
    );
  });
  await settingsChanged();
}

/* ---------------------------------------------------------------- hours */

export async function getHours(): Promise<AdminHoursDTO> {
  const config = await loadRestaurantConfig();
  return { ...config.hours, closures: config.closures, timezone: config.timezone };
}

export async function replaceHours(
  input: z.output<typeof openingHoursInput>,
  actor: Viewer,
): Promise<AdminHoursDTO> {
  for (const r of input.ranges) {
    if (r.opensAt === r.closesAt)
      throw new AppError("VALIDATION_FAILED", "Apertura e chiusura non possono coincidere.");
  }
  await db.$transaction(async (tx) => {
    const before = await tx.openingHour.findMany({
      where: { kind: input.kind },
      orderBy: [{ weekday: "asc" }, { opensAt: "asc" }],
    });
    await tx.openingHour.deleteMany({ where: { kind: input.kind } });
    if (input.ranges.length) {
      await tx.openingHour.createMany({
        data: input.ranges
          .toSorted((a, b) => a.weekday - b.weekday || a.opensAt.localeCompare(b.opensAt))
          .map((r, position) => ({
            kind: input.kind,
            weekday: r.weekday,
            opensAt: r.opensAt,
            closesAt: r.closesAt,
            position,
          })),
      });
    }
    await audit(
      {
        actor,
        action: "hours.updated",
        entityType: "OpeningHour",
        entityId: input.kind,
        before: before.map((h) => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt })),
        after: input.ranges,
      },
      tx,
    );
  });
  await settingsChanged();
  return getHours();
}

export async function addClosure(
  input: z.output<typeof closureInput>,
  actor: Viewer,
): Promise<AdminHoursDTO> {
  await db.$transaction(async (tx) => {
    const c = await tx.closure.create({
      data: {
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        reason: input.reason,
        appliesTo: input.appliesTo,
        isHoliday: input.isHoliday,
        createdById: actor.userId,
      },
    });
    await audit(
      { actor, action: "closure.created", entityType: "Closure", entityId: c.id, after: input },
      tx,
    );
  });
  await settingsChanged();
  return getHours();
}

export async function removeClosure(id: string, actor: Viewer): Promise<AdminHoursDTO> {
  await db.$transaction(async (tx) => {
    const before = await tx.closure.findUnique({ where: { id } });
    if (!before) throw new AppError("NOT_FOUND", "Chiusura non trovata.");
    await tx.closure.delete({ where: { id } });
    await audit({ actor, action: "closure.deleted", entityType: "Closure", entityId: id, before }, tx);
  });
  await settingsChanged();
  return getHours();
}

/* ---------------------------------------------------------------- zones */

type ZoneRow = Prisma.DeliveryZoneGetPayload<object>;

function toAdminZone(z: ZoneRow): AdminZoneDTO {
  return {
    id: z.id,
    name: z.name,
    type: z.type,
    isActive: z.isActive,
    priority: z.priority,
    deliveryFeeCents: z.deliveryFeeCents,
    minimumOrderCents: z.minimumOrderCents,
    freeDeliveryThresholdCents: z.freeDeliveryThresholdCents,
    etaAdjustmentMinutes: z.etaAdjustmentMinutes,
    polygon: (z.polygon as { lat: number; lng: number }[] | null) ?? null,
    center: z.centerLat !== null && z.centerLng !== null ? { lat: z.centerLat, lng: z.centerLng } : null,
    radiusMeters: z.radiusMeters,
    minDistanceMeters: z.minDistanceMeters,
    maxDistanceMeters: z.maxDistanceMeters,
    color: z.color,
  };
}

export async function listZones(): Promise<AdminZoneDTO[]> {
  const rows = await db.deliveryZone.findMany({
    orderBy: [{ priority: "asc" }, { deliveryFeeCents: "asc" }],
  });
  return rows.map(toAdminZone);
}

function zoneData(input: z.output<typeof deliveryZoneInput>) {
  return {
    name: input.name,
    type: input.type,
    isActive: input.isActive,
    priority: input.priority,
    deliveryFeeCents: input.deliveryFeeCents,
    minimumOrderCents: input.minimumOrderCents,
    freeDeliveryThresholdCents: input.freeDeliveryThresholdCents,
    etaAdjustmentMinutes: input.etaAdjustmentMinutes,
    polygon:
      input.type === "POLYGON" && input.polygon ? (input.polygon as Prisma.InputJsonValue) : Prisma.DbNull,
    centerLat: input.type === "CIRCLE" ? (input.center?.lat ?? null) : null,
    centerLng: input.type === "CIRCLE" ? (input.center?.lng ?? null) : null,
    radiusMeters: input.type === "CIRCLE" ? input.radiusMeters : null,
    minDistanceMeters: input.type === "DISTANCE_BAND" ? input.minDistanceMeters : null,
    maxDistanceMeters: input.type === "DISTANCE_BAND" ? input.maxDistanceMeters : null,
    color: input.color,
  };
}

/** Zones affect delivery quotes immediately. */
function zonesChanged(): void {
  expireTags(ZONES_TAG);
}

export async function saveZone(
  input: z.output<typeof deliveryZoneInput>,
  actor: Viewer,
  zoneId?: string,
): Promise<AdminZoneDTO> {
  const saved = await db.$transaction(async (tx) => {
    if (zoneId) {
      const before = await tx.deliveryZone.findUnique({ where: { id: zoneId } });
      if (!before) throw new AppError("NOT_FOUND", "Zona non trovata.");
      const z = await tx.deliveryZone.update({ where: { id: zoneId }, data: zoneData(input) });
      await audit(
        {
          actor,
          action: "zone.updated",
          entityType: "DeliveryZone",
          entityId: zoneId,
          before: toAdminZone(before),
          after: input,
        },
        tx,
      );
      return z;
    }
    const z = await tx.deliveryZone.create({ data: zoneData(input) });
    await audit(
      { actor, action: "zone.created", entityType: "DeliveryZone", entityId: z.id, after: input },
      tx,
    );
    return z;
  });
  zonesChanged();
  return toAdminZone(saved);
}

export async function deleteZone(zoneId: string, actor: Viewer): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.deliveryZone.findUnique({ where: { id: zoneId } });
    if (!before) throw new AppError("NOT_FOUND", "Zona non trovata.");
    await tx.deliveryZone.delete({ where: { id: zoneId } });
    await audit(
      {
        actor,
        action: "zone.deleted",
        entityType: "DeliveryZone",
        entityId: zoneId,
        before: toAdminZone(before),
      },
      tx,
    );
  });
  zonesChanged();
}
