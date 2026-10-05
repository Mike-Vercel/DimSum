import "server-only";
import {
  DEFAULT_ETA_SETTINGS,
  estimateAsapRange,
  getAvailability,
  type EtaSettings,
  type LoyaltyConfig,
  type ScheduleConfig,
  type WeeklyRange,
} from "@dimsum/domain";
import type { FulfillmentType, RestaurantPublicDTO, ServiceStatusDTO, WeeklyHoursDTO } from "@dimsum/types";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "../db";
import { features } from "../env";

export const SETTINGS_TAG = "settings";

export interface RestaurantConfig {
  name: string;
  tagline: string | null;
  legalName: string | null;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
  supportEmail: string | null;
  address: {
    street: string;
    streetNumber: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
    formatted: string;
  };
  location: { lat: number; lng: number };
  googlePlaceId: string | null;
  googleReviewUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  priceRange: string | null;
  timezone: string;
  orderNumberPrefix: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  ordersPaused: boolean;
  pausedUntil: string | null;
  pauseReason: string | null;
  autoAcceptOrders: boolean;
  acceptanceEscalationMinutes: number;
  defaultPrepMinutes: number;
  prepTimeOptions: number[];
  schedulingEnabled: boolean;
  slotIntervalMinutes: number;
  deliveryLeadMinutes: number;
  pickupLeadMinutes: number;
  maxScheduleDays: number;
  lastOrderBufferMinutes: number;
  maxRouteDistanceMeters: number | null;
  maxTravelSeconds: number | null;
  customerCancelWindowMinutes: number;
  onlinePaymentsEnabled: boolean;
  cashOnDeliveryEnabled: boolean;
  cashOnPickupEnabled: boolean;
  tipsEnabled: boolean;
  tipOptionsCents: number[];
  serviceFeeCents: number;
  serviceFeeVatRateBps: number;
  deliveryFeeVatRateBps: number;
  phoneRequiredForDelivery: boolean;
  phoneRequiredForPickup: boolean;
  newOrderSoundEnabled: boolean;
  newOrderSound: string;
  eta: EtaSettings & { typicalTravelMinutes: number };
  loyalty: LoyaltyConfig;
  hours: { venue: WeeklyRange[]; delivery: WeeklyRange[]; pickup: WeeklyRange[] };
  closures: {
    id: string;
    startsAt: string;
    endsAt: string;
    reason: string | null;
    appliesTo: FulfillmentType[];
    isHoliday: boolean;
  }[];
}

const DEFAULT_LOYALTY: LoyaltyConfig = {
  enabled: false,
  programName: "Dimsum Club",
  pointsPerEuro: 1,
  tiers: [],
  expiryMonths: 12,
  birthdayBonusPoints: 0,
  signupBonusPoints: 0,
};

export async function loadRestaurantConfig(): Promise<RestaurantConfig> {
  const [s, hours, closures] = await Promise.all([
    db.restaurantSettings.findUnique({ where: { id: "default" } }),
    db.openingHour.findMany({ orderBy: [{ kind: "asc" }, { weekday: "asc" }, { opensAt: "asc" }] }),
    db.closure.findMany({
      where: { endsAt: { gt: new Date(Date.now() - 86_400_000) } },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  if (!s) throw new Error("Restaurant settings missing: run `npm run db:seed`.");
  const pick = (kind: "VENUE" | "DELIVERY" | "PICKUP") =>
    hours
      .filter((h) => h.kind === kind)
      .map((h) => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt }));
  return {
    name: s.name,
    tagline: s.tagline,
    legalName: s.legalName,
    vatNumber: s.vatNumber,
    phone: s.phone,
    email: s.email,
    supportEmail: s.supportEmail,
    address: {
      street: s.street,
      streetNumber: s.streetNumber,
      postalCode: s.postalCode,
      city: s.city,
      province: s.province,
      country: s.country,
      formatted: s.formattedAddress,
    },
    location: { lat: s.lat, lng: s.lng },
    googlePlaceId: s.googlePlaceId,
    googleReviewUrl: s.googleReviewUrl,
    instagramUrl: s.instagramUrl,
    facebookUrl: s.facebookUrl,
    priceRange: s.priceRange,
    timezone: s.timezone,
    orderNumberPrefix: s.orderNumberPrefix,
    deliveryEnabled: s.deliveryEnabled,
    pickupEnabled: s.pickupEnabled,
    ordersPaused: s.ordersPaused,
    pausedUntil: s.pausedUntil?.toISOString() ?? null,
    pauseReason: s.pauseReason,
    autoAcceptOrders: s.autoAcceptOrders,
    acceptanceEscalationMinutes: s.acceptanceEscalationMinutes,
    defaultPrepMinutes: s.defaultPrepMinutes,
    prepTimeOptions: s.prepTimeOptions,
    schedulingEnabled: s.schedulingEnabled,
    slotIntervalMinutes: s.slotIntervalMinutes,
    deliveryLeadMinutes: s.deliveryLeadMinutes,
    pickupLeadMinutes: s.pickupLeadMinutes,
    maxScheduleDays: s.maxScheduleDays,
    lastOrderBufferMinutes: s.lastOrderBufferMinutes,
    maxRouteDistanceMeters: s.maxRouteDistanceMeters,
    maxTravelSeconds: s.maxTravelSeconds,
    customerCancelWindowMinutes: s.customerCancelWindowMinutes,
    onlinePaymentsEnabled: s.onlinePaymentsEnabled,
    cashOnDeliveryEnabled: s.cashOnDeliveryEnabled,
    cashOnPickupEnabled: s.cashOnPickupEnabled,
    tipsEnabled: s.tipsEnabled,
    tipOptionsCents: s.tipOptionsCents,
    serviceFeeCents: s.serviceFeeCents,
    serviceFeeVatRateBps: s.serviceFeeVatRateBps,
    deliveryFeeVatRateBps: s.deliveryFeeVatRateBps,
    phoneRequiredForDelivery: s.phoneRequiredForDelivery,
    phoneRequiredForPickup: s.phoneRequiredForPickup,
    newOrderSoundEnabled: s.newOrderSoundEnabled,
    newOrderSound: s.newOrderSound,
    eta: {
      ...DEFAULT_ETA_SETTINGS,
      typicalTravelMinutes: 10,
      ...((s.etaSettings ?? {}) as Partial<EtaSettings & { typicalTravelMinutes: number }>),
    },
    loyalty: { ...DEFAULT_LOYALTY, ...((s.loyalty ?? {}) as Partial<LoyaltyConfig>) },
    hours: { venue: pick("VENUE"), delivery: pick("DELIVERY"), pickup: pick("PICKUP") },
    closures: closures.map((c) => ({
      id: c.id,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      reason: c.reason,
      appliesTo: c.appliesTo,
      isHoliday: c.isHoliday,
    })),
  };
}

/** Cached configuration for display and quotes; checkout always re-reads it fresh. */
export async function getRestaurantConfig(): Promise<RestaurantConfig> {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_TAG);
  return loadRestaurantConfig();
}

export function toScheduleConfig(c: RestaurantConfig): ScheduleConfig {
  return {
    timezone: c.timezone,
    delivery: c.hours.delivery,
    pickup: c.hours.pickup,
    closures: c.closures.map((x) => ({
      startsAt: new Date(x.startsAt),
      endsAt: new Date(x.endsAt),
      reason: x.reason,
      appliesTo: x.appliesTo.length ? x.appliesTo : null,
    })),
    ordersPaused: c.ordersPaused,
    pausedUntil: c.pausedUntil ? new Date(c.pausedUntil) : null,
    slotIntervalMinutes: c.slotIntervalMinutes,
    deliveryLeadMinutes: c.deliveryLeadMinutes,
    pickupLeadMinutes: c.pickupLeadMinutes,
    maxScheduleDays: c.maxScheduleDays,
    schedulingEnabled: c.schedulingEnabled,
    lastOrderBufferMinutes: c.lastOrderBufferMinutes,
  };
}

export interface LiveLoad {
  kitchenQueue: number;
  ridersAvailable: number;
}

export async function loadLiveLoad(): Promise<LiveLoad> {
  const [kitchenQueue, ridersAvailable] = await Promise.all([
    db.order.count({ where: { status: { in: ["RECEIVED", "CONFIRMED", "PREPARING"] } } }),
    db.rider.count({ where: { isActive: true, availability: "AVAILABLE" } }),
  ]);
  return { kitchenQueue, ridersAvailable };
}

export function computeServiceStatus(c: RestaurantConfig, load: LiveLoad, now: Date): ServiceStatusDTO {
  const schedule = toScheduleConfig(c);
  const paymentPossible =
    (features().paymentProvider !== null && c.onlinePaymentsEnabled) ||
    c.cashOnDeliveryEnabled ||
    c.cashOnPickupEnabled;

  const one = (kind: FulfillmentType) => {
    const enabled = kind === "DELIVERY" ? c.deliveryEnabled : c.pickupEnabled;
    const a = getAvailability(schedule, kind, now);
    const available = enabled && paymentPossible && a.available;
    const range = estimateAsapRange({
      now,
      fulfillmentType: kind,
      kitchenQueue: load.kitchenQueue,
      // With no rider on shift yet, staff assign one on acceptance: estimate as if one is free.
      ridersAvailable: Math.max(1, load.ridersAvailable),
      minutesUntilNextFree: null,
      restaurantToCustomerSeconds: null,
      typicalTravelSeconds: c.eta.typicalTravelMinutes * 60,
      zoneAdjustmentMinutes: 0,
      settings: c.eta,
    });
    return {
      available,
      etaMinMinutes: available ? range.minMinutes : null,
      etaMaxMinutes: available ? range.maxMinutes : null,
      closesAt: a.currentWindow?.end.toISOString() ?? null,
      nextAvailableAt: enabled ? (a.nextOpeningAt?.toISOString() ?? null) : null,
      reason: a.reason,
      closureReason: a.closureReason,
    };
  };

  const delivery = one("DELIVERY");
  const pickup = one("PICKUP");
  const isPaused = c.ordersPaused && (!c.pausedUntil || new Date(c.pausedUntil) > now);
  const next =
    [delivery.nextAvailableAt, pickup.nextAvailableAt].filter((x): x is string => !!x).sort()[0] ?? null;

  return {
    isOpen: delivery.available || pickup.available,
    acceptingOrders: !isPaused && (delivery.available || pickup.available),
    isPaused,
    closureReason: delivery.closureReason ?? pickup.closureReason ?? (isPaused ? c.pauseReason : null),
    delivery: {
      available: delivery.available,
      etaMinMinutes: delivery.etaMinMinutes,
      etaMaxMinutes: delivery.etaMaxMinutes,
      closesAt: delivery.closesAt,
      nextAvailableAt: delivery.nextAvailableAt,
    },
    pickup: {
      available: pickup.available,
      etaMinMinutes: pickup.etaMinMinutes,
      etaMaxMinutes: pickup.etaMaxMinutes,
      closesAt: pickup.closesAt,
      nextAvailableAt: pickup.nextAvailableAt,
    },
    nextOpeningAt: next,
    schedulingEnabled: c.schedulingEnabled,
  };
}

export async function getServiceStatus(now = new Date()): Promise<ServiceStatusDTO> {
  const [config, load] = await Promise.all([getRestaurantConfig(), loadLiveLoad()]);
  return computeServiceStatus(config, load, now);
}

function weekly(ranges: WeeklyRange[]): WeeklyHoursDTO[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    ranges: ranges
      .filter((r) => r.weekday === weekday)
      .map((r) => ({ opensAt: r.opensAt, closesAt: r.closesAt })),
  }));
}

/** Static restaurant data (no time-dependent status): safe in prerendered layouts. */
export function toRestaurantInfo(c: RestaurantConfig): Omit<RestaurantPublicDTO, "status"> {
  const online = features().paymentProvider !== null && c.onlinePaymentsEnabled;
  return {
    name: c.name,
    tagline: c.tagline,
    address: c.address,
    location: c.location,
    phone: c.phone,
    email: c.email,
    timezone: c.timezone,
    currency: "EUR",
    venueHours: weekly(c.hours.venue),
    deliveryHours: weekly(c.hours.delivery),
    pickupHours: weekly(c.hours.pickup),
    checkout: {
      paymentMethods: {
        online,
        cashOnDelivery: c.cashOnDeliveryEnabled,
        cashOnPickup: c.cashOnPickupEnabled,
      },
      onlinePaymentsLive: features().paymentProvider === "stripe",
      tipOptionsCents: c.tipOptionsCents,
      tipsEnabled: c.tipsEnabled,
      phoneRequiredForDelivery: c.phoneRequiredForDelivery,
      phoneRequiredForPickup: c.phoneRequiredForPickup,
      serviceFeeCents: c.serviceFeeCents,
      maxScheduleDays: c.maxScheduleDays,
    },
    loyalty: { enabled: c.loyalty.enabled, programName: c.loyalty.programName },
    legal: { companyName: c.legalName, vatNumber: c.vatNumber },
    social: { googleReviewUrl: c.googleReviewUrl, instagramUrl: c.instagramUrl, facebookUrl: c.facebookUrl },
  };
}

export function toRestaurantPublic(c: RestaurantConfig, status: ServiceStatusDTO): RestaurantPublicDTO {
  return { ...toRestaurantInfo(c), status };
}

export async function getRestaurantPublic(now = new Date()): Promise<RestaurantPublicDTO> {
  const [config, status] = await Promise.all([getRestaurantConfig(), getServiceStatus(now)]);
  return toRestaurantPublic(config, status);
}
