import "server-only";
import {
  estimateAsapRange,
  resolveDeliveryZone,
  type DeliveryZoneRule,
  type LatLng,
  type RouteInfo,
} from "@dimsum/domain";
import type { DeliveryQuoteDTO, DeliveryZoneDTO, GeoPoint } from "@dimsum/types";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "../db";
import { routeBetween } from "../maps";
import { getRestaurantConfig, loadLiveLoad, type RestaurantConfig } from "./restaurant";

export const ZONES_TAG = "zones";

export async function loadDeliveryZones(): Promise<DeliveryZoneRule[]> {
  const rows = await db.deliveryZone.findMany({
    orderBy: [{ priority: "asc" }, { deliveryFeeCents: "asc" }],
  });
  return rows.map((z) => ({
    id: z.id,
    name: z.name,
    type: z.type,
    isActive: z.isActive,
    priority: z.priority,
    deliveryFeeCents: z.deliveryFeeCents,
    minimumOrderCents: z.minimumOrderCents,
    freeDeliveryThresholdCents: z.freeDeliveryThresholdCents,
    etaAdjustmentMinutes: z.etaAdjustmentMinutes,
    polygon: (z.polygon as LatLng[] | null) ?? null,
    center: z.centerLat !== null && z.centerLng !== null ? { lat: z.centerLat, lng: z.centerLng } : null,
    radiusMeters: z.radiusMeters,
    minDistanceMeters: z.minDistanceMeters,
    maxDistanceMeters: z.maxDistanceMeters,
  }));
}

export async function getDeliveryZones(): Promise<DeliveryZoneRule[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(ZONES_TAG);
  return loadDeliveryZones();
}

export function toZoneDTO(z: DeliveryZoneRule): DeliveryZoneDTO {
  return {
    id: z.id,
    name: z.name,
    type: z.type,
    deliveryFeeCents: z.deliveryFeeCents,
    minimumOrderCents: z.minimumOrderCents,
    freeDeliveryThresholdCents: z.freeDeliveryThresholdCents,
  };
}

export interface DeliveryResolution {
  quote: DeliveryQuoteDTO;
  zone: DeliveryZoneRule | null;
  route: RouteInfo | null;
}

/**
 * Deliverability of a point: real route first (distance + travel time), then zone matching and
 * global limits. Imprecise addresses (no house number) are refused before any routing call.
 */
export async function resolveDelivery(
  destination: GeoPoint,
  precision: "rooftop" | "street" | "approximate",
  options: { config?: RestaurantConfig; zones?: DeliveryZoneRule[] } = {},
): Promise<DeliveryResolution> {
  const config = options.config ?? (await getRestaurantConfig());
  if (precision === "approximate") {
    return {
      quote: {
        deliverable: false,
        reason: "ADDRESS_IMPRECISE",
        zone: null,
        route: null,
        etaMinMinutes: null,
        etaMaxMinutes: null,
      },
      zone: null,
      route: null,
    };
  }
  if (!config.deliveryEnabled) {
    return {
      quote: {
        deliverable: false,
        reason: "DELIVERY_UNAVAILABLE",
        zone: null,
        route: null,
        etaMinMinutes: null,
        etaMaxMinutes: null,
      },
      zone: null,
      route: null,
    };
  }

  const [zones, route, load] = await Promise.all([
    options.zones ? Promise.resolve(options.zones) : getDeliveryZones(),
    routeBetween(config.location, destination),
    loadLiveLoad(),
  ]);
  const routeInfo: RouteInfo = {
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    source: route.source,
  };
  const resolution = resolveDeliveryZone(zones, destination, routeInfo, {
    maxRouteDistanceMeters: config.maxRouteDistanceMeters,
    maxTravelSeconds: config.maxTravelSeconds,
  });

  if (!resolution.deliverable) {
    return {
      quote: {
        deliverable: false,
        reason: resolution.reason,
        zone: null,
        route: routeInfo,
        etaMinMinutes: null,
        etaMaxMinutes: null,
      },
      zone: null,
      route: routeInfo,
    };
  }

  const eta = estimateAsapRange({
    now: new Date(),
    fulfillmentType: "DELIVERY",
    kitchenQueue: load.kitchenQueue,
    ridersAvailable: Math.max(1, load.ridersAvailable),
    minutesUntilNextFree: null,
    restaurantToCustomerSeconds: routeInfo.durationSeconds,
    typicalTravelSeconds: config.eta.typicalTravelMinutes * 60,
    zoneAdjustmentMinutes: resolution.zone.etaAdjustmentMinutes,
    settings: config.eta,
  });

  return {
    quote: {
      deliverable: true,
      reason: null,
      zone: toZoneDTO(resolution.zone),
      route: routeInfo,
      etaMinMinutes: eta.minMinutes,
      etaMaxMinutes: eta.maxMinutes,
    },
    zone: resolution.zone,
    route: routeInfo,
  };
}
