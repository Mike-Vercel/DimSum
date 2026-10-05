/**
 * Reference data and restaurant configuration taken from the real DIMSUM source.
 * Idempotent: existing rows edited from the admin are never overwritten.
 */
import type { Database } from "../client";
import type { NormalizedCatalog } from "../catalog-source/types";

const ALLERGENS = [
  ["GLUTEN", "Glutine", "Cereali contenenti glutine: grano, segale, orzo, avena, farro, kamut e derivati."],
  ["CRUSTACEANS", "Crostacei", "Crostacei e prodotti a base di crostacei."],
  ["EGGS", "Uova", "Uova e prodotti a base di uova."],
  ["FISH", "Pesce", "Pesce e prodotti a base di pesce."],
  ["PEANUTS", "Arachidi", "Arachidi e prodotti a base di arachidi."],
  ["SOYBEANS", "Soia", "Soia e prodotti a base di soia."],
  ["MILK", "Latte", "Latte e prodotti a base di latte, incluso il lattosio."],
  [
    "NUTS",
    "Frutta a guscio",
    "Mandorle, nocciole, noci, anacardi, noci pecan, noci del Brasile, pistacchi, noci macadamia.",
  ],
  ["CELERY", "Sedano", "Sedano e prodotti a base di sedano."],
  ["MUSTARD", "Senape", "Senape e prodotti a base di senape."],
  ["SESAME", "Sesamo", "Semi di sesamo e prodotti a base di semi di sesamo."],
  ["SULPHITES", "Solfiti", "Anidride solforosa e solfiti in concentrazioni superiori a 10 mg/kg o 10 mg/l."],
  ["LUPIN", "Lupini", "Lupini e prodotti a base di lupini."],
  ["MOLLUSCS", "Molluschi", "Molluschi e prodotti a base di molluschi."],
] as const;

export async function seedReference(db: Database, catalog: NormalizedCatalog): Promise<void> {
  for (const [code, name, description] of ALLERGENS) {
    await db.allergenInfo.upsert({
      where: { code },
      create: { code, name, description },
      update: { name, description },
    });
  }

  const r = catalog.restaurant;
  const existing = await db.restaurantSettings.findUnique({ where: { id: "default" } });
  if (!existing) {
    await db.restaurantSettings.create({
      data: {
        id: "default",
        name: r.name,
        tagline: "Asian street food · Palermo",
        phone: r.phone,
        street: r.address.street,
        streetNumber: r.address.streetNumber,
        postalCode: r.address.postalCode,
        city: r.address.city,
        province: r.address.province,
        country: r.address.country,
        formattedAddress: r.address.formatted,
        lat: r.location.lat,
        lng: r.location.lng,
        googlePlaceId: r.googlePlaceId,
        googleReviewUrl: r.googleReviewUrl,
        priceRange: r.priceRange,
        timezone: r.timezone,
        deliveryLeadMinutes: r.deliveryLeadMinutes,
        pickupLeadMinutes: r.pickupLeadMinutes,
        maxScheduleDays: r.maxScheduleDays,
        customerCancelWindowMinutes: r.customerCancelWindowMinutes,
        defaultPrepMinutes: r.pickupLeadMinutes,
        deliveryFeeVatRateBps: r.deliveryFeeVatRateBps,
        cashOnDeliveryEnabled: r.cashOnDelivery,
        cashOnPickupEnabled: r.cashOnDelivery,
        loyalty: {
          enabled: false,
          programName: "Dimsum Club",
          pointsPerEuro: 1,
          tiers: [],
          expiryMonths: 12,
          birthdayBonusPoints: 0,
          signupBonusPoints: 0,
        },
      },
    });
  }

  if ((await db.openingHour.count()) === 0) {
    const rows = [
      ...r.venueHours.map((h, i) => ({ kind: "VENUE" as const, ...h, position: i })),
      ...r.deliveryHours.map((h, i) => ({ kind: "DELIVERY" as const, ...h, position: i })),
      ...r.pickupHours.map((h, i) => ({ kind: "PICKUP" as const, ...h, position: i })),
    ];
    await db.openingHour.createMany({ data: rows });
  }

  for (const z of catalog.deliveryZones) {
    const where = {
      sourceProvider_sourceId: { sourceProvider: catalog.source.provider, sourceId: z.sourceId },
    };
    if (await db.deliveryZone.findUnique({ where })) continue;
    await db.deliveryZone.create({
      data: {
        name: z.name,
        type: z.type,
        isActive: z.isActive,
        priority: z.priority,
        deliveryFeeCents: z.deliveryFeeCents,
        minimumOrderCents: z.minimumOrderCents,
        freeDeliveryThresholdCents: z.freeDeliveryThresholdCents,
        polygon: z.polygon ?? undefined,
        centerLat: z.center?.lat ?? null,
        centerLng: z.center?.lng ?? null,
        radiusMeters: z.radiusMeters,
        color: ["#D82A1E", "#E8A317", "#1F6FB2"][z.priority - 1] ?? null,
        sourceProvider: catalog.source.provider,
        sourceId: z.sourceId,
      },
    });
  }

  for (const p of catalog.promotions) {
    const where = {
      sourceProvider_sourceId: { sourceProvider: catalog.source.provider, sourceId: p.sourceId },
    };
    if (await db.coupon.findUnique({ where })) continue;
    await db.coupon.create({
      data: {
        // Automatic promotion: applied at checkout without a code, as on the previous platform.
        code: p.autoApply ? null : p.sourceCode,
        name: p.name,
        description: "Su tutto il menu, per una spesa superiore a € 30.",
        type: p.type,
        percentBps: p.percentBps,
        amountCents: p.amountCents,
        minSubtotalCents: p.minSubtotalCents,
        isActive: p.isActive,
        autoApply: p.autoApply,
        isPublic: true,
        perCustomerLimit: p.perCustomerLimit,
        fulfillmentTypes: [],
        sourceProvider: catalog.source.provider,
        sourceId: p.sourceId,
      },
    });
  }
}
