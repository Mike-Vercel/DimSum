/**
 * Delivery zone resolution.
 *
 * Deliverability never relies on straight-line distance alone: the server first computes the real
 * route (distance + travel time) with the routing provider, then
 *  - POLYGON zones match on the geocoded point,
 *  - CIRCLE zones (imported from the previous platform) match on the geodesic radius,
 *  - DISTANCE_BAND zones match on the ROUTE distance from the restaurant,
 * and global limits on route distance / travel time always apply on top.
 */
import type { DeliveryRefusalReason, DeliveryZoneType } from "@dimsum/types";
import { haversineMeters, pointInPolygon, type LatLng } from "./geo";
import type { Cents } from "./money";

export interface DeliveryZoneRule {
  id: string;
  name: string;
  type: DeliveryZoneType;
  isActive: boolean;
  /** Lower number wins when zones overlap (e.g. a small cheap circle inside a larger polygon). */
  priority: number;
  deliveryFeeCents: Cents;
  minimumOrderCents: Cents;
  freeDeliveryThresholdCents: Cents | null;
  /** Extra minutes added to the ETA for this zone (traffic, ZTL, hills…). */
  etaAdjustmentMinutes: number;
  polygon: LatLng[] | null;
  center: LatLng | null;
  radiusMeters: number | null;
  minDistanceMeters: number | null;
  maxDistanceMeters: number | null;
}

export interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  source: "routing" | "estimate";
}

export interface DeliveryLimits {
  /** Hard cap on the route distance (meters). null = no cap. */
  maxRouteDistanceMeters: number | null;
  /** Hard cap on the travel time (seconds). null = no cap. */
  maxTravelSeconds: number | null;
}

export type ZoneResolution =
  | { deliverable: true; zone: DeliveryZoneRule; route: RouteInfo }
  | {
      deliverable: false;
      reason: DeliveryRefusalReason;
      route: RouteInfo | null;
      nearestZone: DeliveryZoneRule | null;
    };

export function zoneContains(zone: DeliveryZoneRule, point: LatLng, route: RouteInfo): boolean {
  switch (zone.type) {
    case "POLYGON":
      return !!zone.polygon && pointInPolygon(point, zone.polygon);
    case "CIRCLE":
      return (
        !!zone.center &&
        zone.radiusMeters !== null &&
        haversineMeters(zone.center, point) <= zone.radiusMeters
      );
    case "DISTANCE_BAND": {
      const min = zone.minDistanceMeters ?? 0;
      const max = zone.maxDistanceMeters ?? Number.POSITIVE_INFINITY;
      return route.distanceMeters >= min && route.distanceMeters < max;
    }
  }
}

export function resolveDeliveryZone(
  zones: readonly DeliveryZoneRule[],
  destination: LatLng,
  route: RouteInfo,
  limits: DeliveryLimits,
): ZoneResolution {
  if (limits.maxRouteDistanceMeters !== null && route.distanceMeters > limits.maxRouteDistanceMeters) {
    return { deliverable: false, reason: "TOO_FAR", route, nearestZone: null };
  }
  if (limits.maxTravelSeconds !== null && route.durationSeconds > limits.maxTravelSeconds) {
    return { deliverable: false, reason: "TOO_FAR", route, nearestZone: null };
  }

  const ordered = [...zones].sort(
    (a, b) => a.priority - b.priority || a.deliveryFeeCents - b.deliveryFeeCents,
  );
  const matching = ordered.filter((z) => zoneContains(z, destination, route));
  const active = matching.find((z) => z.isActive);
  if (active) return { deliverable: true, zone: active, route };
  if (matching.length > 0) {
    return { deliverable: false, reason: "ZONE_DISABLED", route, nearestZone: matching[0] ?? null };
  }
  return { deliverable: false, reason: "OUT_OF_ZONE", route, nearestZone: null };
}

/** Delivery fee after the zone's free-delivery threshold (evaluated on the items subtotal). */
export function deliveryFeeFor(
  zone: Pick<DeliveryZoneRule, "deliveryFeeCents" | "freeDeliveryThresholdCents">,
  subtotalCents: Cents,
): Cents {
  if (zone.freeDeliveryThresholdCents !== null && subtotalCents >= zone.freeDeliveryThresholdCents) return 0;
  return zone.deliveryFeeCents;
}

export function describeRefusal(reason: DeliveryRefusalReason): string {
  switch (reason) {
    case "OUT_OF_ZONE":
    case "TOO_FAR":
      return "Questo indirizzo è fuori dalla nostra zona di consegna.";
    case "ZONE_DISABLED":
      return "Al momento non consegniamo in questa zona.";
    case "ADDRESS_IMPRECISE":
      return "Non riusciamo a localizzare con precisione questo indirizzo: aggiungi il numero civico o sposta il pin.";
    case "DELIVERY_UNAVAILABLE":
      return "La consegna al momento non è disponibile.";
  }
}
