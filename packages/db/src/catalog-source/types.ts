/** Shape of `data/brenvo/catalog.json`, the normalized snapshot of the real DIMSUM menu. */
import type { Allergen, ImageBackdrop, ProductTag } from "@dimsum/types";

export interface NormalizedWeeklyRange {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface NormalizedImage {
  url: string;
  width: number;
  height: number;
  alt: string;
  blurDataUrl: string;
  dominantColor: string;
  backdrop: ImageBackdrop;
  sourceWidth: number;
  sourceHeight: number;
}

export interface NormalizedZone {
  sourceId: string;
  sourceOrder: number;
  name: string;
  type: "POLYGON" | "CIRCLE";
  priority: number;
  isActive: boolean;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  freeDeliveryThresholdCents: number | null;
  polygon: { lat: number; lng: number }[] | null;
  center: { lat: number; lng: number } | null;
  radiusMeters: number | null;
}

export interface NormalizedProduct {
  sourceId: string;
  categorySourceId: string;
  position: number;
  slug: string;
  name: string;
  sourceName: string;
  sourceName2: string;
  nameZh: string | null;
  description: string | null;
  descriptionZh: string | null;
  sourceDescription: string;
  ingredients: string[];
  posCode: string | null;
  priceCents: number;
  vatRateBps: number;
  allergens: Allergen[];
  allergensDeclared: boolean;
  tags: ProductTag[];
  spicyLevel: 0 | 1 | 2 | 3;
  excludedFromDiscounts: boolean;
  isAvailable: boolean;
  image: NormalizedImage | null;
}

export interface NormalizedCatalog {
  source: {
    provider: "brenvo";
    restaurantId: string;
    menuUrl: string;
    restaurantUrl: string;
    capturedAt: string;
  };
  restaurant: {
    name: string;
    sourceName: string;
    phone: string;
    address: {
      street: string;
      streetNumber: string;
      postalCode: string;
      city: string;
      province: string;
      region: string;
      country: string;
      formatted: string;
    };
    location: { lat: number; lng: number };
    googlePlaceId: string | null;
    timezone: string;
    venueHours: NormalizedWeeklyRange[];
    deliveryHours: NormalizedWeeklyRange[];
    pickupHours: NormalizedWeeklyRange[];
    vatRateBps: number;
    deliveryFeeVatRateBps: number;
    pickupLeadMinutes: number;
    deliveryLeadMinutes: number;
    maxScheduleDays: number;
    customerCancelWindowMinutes: number;
    cashOnDelivery: boolean;
    priceRange: string | null;
    googleReviewUrl: string | null;
  };
  deliveryZones: NormalizedZone[];
  promotions: {
    sourceId: string;
    sourceCode: string;
    name: string;
    type: "PERCENTAGE" | "FIXED_AMOUNT";
    percentBps: number | null;
    amountCents: number | null;
    minSubtotalCents: number | null;
    autoApply: boolean;
    perCustomerLimit: number | null;
    redemptionsCount: number;
    isActive: boolean;
  }[];
  categories: { sourceId: string; name: string; slug: string; position: number; isVisible: boolean }[];
  modifierGroups: {
    key: string;
    name: string;
    description: string | null;
    sourceCategoryName: string;
    minSelect: number;
    maxSelect: number;
    maxTotalQuantity: number;
    optionMaxQuantity: number;
    attachToCategorySourceIds: string[];
    options: {
      sourceId: string;
      name: string;
      sourceName: string;
      priceDeltaCents: number;
      position: number;
    }[];
  }[];
  products: NormalizedProduct[];
}
