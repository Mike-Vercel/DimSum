import { describe, expect, it } from "vitest";
import catalog from "../../db/data/brenvo/catalog.json" with { type: "json" };
import {
  deliveryFeeFor,
  estimateUrbanTravel,
  resolveDeliveryZone,
  type DeliveryZoneRule,
  type LatLng,
} from "../src";

/** The real DIMSUM zones imported from the previous platform. */
const realZones: DeliveryZoneRule[] = catalog.deliveryZones.map((z) => ({
  id: z.sourceId,
  name: z.name,
  type: z.type as DeliveryZoneRule["type"],
  isActive: z.isActive,
  priority: z.priority,
  deliveryFeeCents: z.deliveryFeeCents,
  minimumOrderCents: z.minimumOrderCents,
  freeDeliveryThresholdCents: z.freeDeliveryThresholdCents,
  etaAdjustmentMinutes: 0,
  polygon: z.polygon,
  center: z.center,
  radiusMeters: z.radiusMeters,
  minDistanceMeters: null,
  maxDistanceMeters: null,
}));

const restaurant: LatLng = catalog.restaurant.location;
const places = {
  restaurant,
  teatroMassimo: { lat: 38.1197, lng: 13.357 },
  stazioneCentrale: { lat: 38.1093, lng: 13.367 },
  mondello: { lat: 38.2047, lng: 13.3236 },
};
const noLimits = { maxRouteDistanceMeters: null, maxTravelSeconds: null };
const routeTo = (p: LatLng) => ({ ...estimateUrbanTravel(restaurant, p), source: "estimate" as const });

describe("resolveDeliveryZone with the real DIMSUM zones", () => {
  it("prefers the cheapest, innermost zone where zones overlap", () => {
    const r = resolveDeliveryZone(realZones, places.restaurant, routeTo(places.restaurant), noLimits);
    expect(r.deliverable && r.zone.deliveryFeeCents).toBe(200);
    expect(r.deliverable && r.zone.minimumOrderCents).toBe(1000);
  });

  it("assigns the city-centre polygon (€ 3, min € 20)", () => {
    const r = resolveDeliveryZone(realZones, places.teatroMassimo, routeTo(places.teatroMassimo), noLimits);
    expect(r).toMatchObject({ deliverable: true, zone: { deliveryFeeCents: 300, minimumOrderCents: 2000 } });
  });

  it("assigns the extended polygon (€ 5)", () => {
    const r = resolveDeliveryZone(
      realZones,
      places.stazioneCentrale,
      routeTo(places.stazioneCentrale),
      noLimits,
    );
    expect(r).toMatchObject({ deliverable: true, zone: { deliveryFeeCents: 500 } });
  });

  it("refuses addresses outside every zone", () => {
    const r = resolveDeliveryZone(realZones, places.mondello, routeTo(places.mondello), noLimits);
    expect(r).toMatchObject({ deliverable: false, reason: "OUT_OF_ZONE" });
  });

  it("applies global route limits even inside a polygon (no crow-flies shortcut)", () => {
    const longRoute = { distanceMeters: 9_000, durationSeconds: 1_800, source: "routing" as const };
    const r = resolveDeliveryZone(realZones, places.teatroMassimo, longRoute, {
      maxRouteDistanceMeters: 6_000,
      maxTravelSeconds: null,
    });
    expect(r).toMatchObject({ deliverable: false, reason: "TOO_FAR" });
    const slow = resolveDeliveryZone(
      realZones,
      places.teatroMassimo,
      { ...longRoute, distanceMeters: 2_000 },
      { maxRouteDistanceMeters: null, maxTravelSeconds: 1_200 },
    );
    expect(slow).toMatchObject({ deliverable: false, reason: "TOO_FAR" });
  });

  it("falls through disabled zones and reports them", () => {
    const zones = realZones.map((z) => (z.priority === 2 ? { ...z, isActive: false } : z));
    const r = resolveDeliveryZone(zones, places.teatroMassimo, routeTo(places.teatroMassimo), noLimits);
    expect(r).toMatchObject({ deliverable: true, zone: { priority: 3 } });
    const allOff = realZones.map((z) => ({ ...z, isActive: false }));
    expect(
      resolveDeliveryZone(allOff, places.teatroMassimo, routeTo(places.teatroMassimo), noLimits),
    ).toMatchObject({
      deliverable: false,
      reason: "ZONE_DISABLED",
    });
  });
});

describe("distance bands on route distance", () => {
  const band = (id: string, min: number, max: number, fee: number): DeliveryZoneRule => ({
    id,
    name: `${min}-${max}`,
    type: "DISTANCE_BAND",
    isActive: true,
    priority: 10,
    deliveryFeeCents: fee,
    minimumOrderCents: 1500,
    freeDeliveryThresholdCents: 4000,
    etaAdjustmentMinutes: 0,
    polygon: null,
    center: null,
    radiusMeters: null,
    minDistanceMeters: min,
    maxDistanceMeters: max,
  });
  const bands = [band("a", 0, 2000, 150), band("b", 2000, 4000, 250), band("c", 4000, 6000, 350)];
  const at = { lat: 38.12, lng: 13.36 };

  it("matches the band of the ROUTE distance, not the straight line", () => {
    const r = resolveDeliveryZone(
      bands,
      at,
      { distanceMeters: 4200, durationSeconds: 900, source: "routing" },
      noLimits,
    );
    expect(r).toMatchObject({ deliverable: true, zone: { id: "c" } });
    expect(
      resolveDeliveryZone(
        bands,
        at,
        { distanceMeters: 6100, durationSeconds: 900, source: "routing" },
        noLimits,
      ),
    ).toMatchObject({
      deliverable: false,
      reason: "OUT_OF_ZONE",
    });
  });

  it("grants free delivery above the zone threshold", () => {
    expect(deliveryFeeFor(bands[0]!, 3999)).toBe(150);
    expect(deliveryFeeFor(bands[0]!, 4000)).toBe(0);
  });
});
