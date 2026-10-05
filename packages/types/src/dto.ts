/**
 * Response DTOs of the versioned REST API (`/api/v1`).
 * Money is ALWAYS an integer amount of euro cents. Dates are ISO-8601 strings (UTC).
 */
import type {
  Allergen,
  ConsentType,
  CouponType,
  DeliveryStatus,
  DeliveryZoneType,
  FulfillmentType,
  ImageBackdrop,
  LoyaltyTransactionType,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductTag,
  RiderAvailability,
  Role,
  SupportCategory,
  SupportStatus,
} from "./enums";

export type Cents = number;
export type ISODateString = string;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    details?: unknown;
  };
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export interface ImageDTO {
  url: string;
  width: number;
  height: number;
  alt: string;
  blurDataUrl: string | null;
  dominantColor: string | null;
  /** Food shots on dark set vs. packshots on white: drives cropping and card surface. */
  backdrop: ImageBackdrop;
}

export interface ModifierDTO {
  id: string;
  name: string;
  priceDeltaCents: Cents;
  isAvailable: boolean;
  maxQuantity: number;
}

export interface ModifierGroupDTO {
  id: string;
  name: string;
  description: string | null;
  minSelect: number;
  maxSelect: number;
  /** Sum of quantities allowed across options (≥ maxSelect when options allow quantity > 1). */
  maxTotalQuantity: number;
  options: ModifierDTO[];
}

export interface VariantDTO {
  id: string;
  name: string;
  priceCents: Cents;
  isAvailable: boolean;
}

export interface ProductDTO {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  nameZh: string | null;
  description: string | null;
  descriptionZh: string | null;
  ingredients: string[];
  posCode: string | null;
  priceCents: Cents;
  image: ImageDTO | null;
  allergens: Allergen[];
  /** True when the allergen list was explicitly reviewed for this product. */
  allergensDeclared: boolean;
  tags: ProductTag[];
  spicyLevel: 0 | 1 | 2 | 3;
  isAvailable: boolean;
  /** When the product is sold out, the moment it becomes orderable again (if scheduled). */
  availableAgainAt: ISODateString | null;
  isFeatured: boolean;
  variants: VariantDTO[];
  modifierGroups: ModifierGroupDTO[];
  excludedFromDiscounts: boolean;
}

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: ImageDTO | null;
  productIds: string[];
}

export interface CatalogDTO {
  categories: CategoryDTO[];
  products: Record<string, ProductDTO>;
  /** Product ids ordered by sales in the last 30 days, falling back to staff picks. */
  bestsellerIds: string[];
  version: string;
}

export interface AvailabilityPatchDTO {
  productId: string;
  isAvailable: boolean;
  availableAgainAt: ISODateString | null;
}

/* ------------------------------------------------------------------ */
/* Restaurant & opening hours                                          */
/* ------------------------------------------------------------------ */

export interface TimeRangeDTO {
  /** "HH:mm" in the restaurant timezone. */
  opensAt: string;
  closesAt: string;
}

export interface WeeklyHoursDTO {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  ranges: TimeRangeDTO[];
}

export interface ServiceStatusDTO {
  isOpen: boolean;
  /** False when staff paused new orders or the restaurant is closed. */
  acceptingOrders: boolean;
  isPaused: boolean;
  closureReason: string | null;
  delivery: FulfillmentAvailabilityDTO;
  pickup: FulfillmentAvailabilityDTO;
  nextOpeningAt: ISODateString | null;
  schedulingEnabled: boolean;
}

export interface FulfillmentAvailabilityDTO {
  available: boolean;
  /** Estimated minutes from now (range) when ordering ASAP. */
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
  closesAt: ISODateString | null;
  nextAvailableAt: ISODateString | null;
}

export interface RestaurantPublicDTO {
  name: string;
  tagline: string | null;
  address: {
    street: string;
    streetNumber: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
    formatted: string;
  };
  location: GeoPoint;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: "EUR";
  venueHours: WeeklyHoursDTO[];
  deliveryHours: WeeklyHoursDTO[];
  pickupHours: WeeklyHoursDTO[];
  status: ServiceStatusDTO;
  checkout: {
    paymentMethods: { online: boolean; cashOnDelivery: boolean; cashOnPickup: boolean };
    onlinePaymentsLive: boolean;
    tipOptionsCents: Cents[];
    tipsEnabled: boolean;
    phoneRequiredForDelivery: boolean;
    phoneRequiredForPickup: boolean;
    serviceFeeCents: Cents;
    maxScheduleDays: number;
  };
  loyalty: { enabled: boolean; programName: string };
  legal: { companyName: string | null; vatNumber: string | null };
  social: { googleReviewUrl: string | null; instagramUrl: string | null; facebookUrl: string | null };
  /**
   * Address search. "device": the app queries Nominatim (OpenStreetMap) directly from the
   * customer's device, with explicit searches only (its usage policy forbids autocomplete), because
   * the free public services do not answer cloud servers reliably. "server": /api/v1/geo/*.
   */
  geocoding: { mode: "device" | "server"; nominatimUrl: string | null };
}

export interface TimeSlotDTO {
  start: ISODateString;
  end: ISODateString;
  label: string;
  available: boolean;
}

export interface DaySlotsDTO {
  date: string;
  label: string;
  slots: TimeSlotDTO[];
}

/* ------------------------------------------------------------------ */
/* Addresses, geocoding, delivery                                      */
/* ------------------------------------------------------------------ */

export interface AddressFields {
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
}

export interface GeocodedAddressDTO extends AddressFields {
  formatted: string;
  location: GeoPoint;
  placeId: string | null;
  /** "rooftop" when the house number was resolved, "street"/"approximate" otherwise. */
  precision: "rooftop" | "street" | "approximate";
}

export interface AddressSuggestionDTO {
  id: string;
  primaryText: string;
  secondaryText: string;
}

export interface DeliveryDetailsFields {
  staircase: string | null;
  floor: string | null;
  apartment: string | null;
  intercom: string | null;
  riderNotes: string | null;
}

export interface SavedAddressDTO extends GeocodedAddressDTO, DeliveryDetailsFields {
  id: string;
  label: string | null;
  isDefault: boolean;
}

export interface DeliveryZoneDTO {
  id: string;
  name: string;
  type: DeliveryZoneType;
  deliveryFeeCents: Cents;
  minimumOrderCents: Cents;
  freeDeliveryThresholdCents: Cents | null;
}

export type DeliveryRefusalReason =
  "OUT_OF_ZONE" | "TOO_FAR" | "ZONE_DISABLED" | "ADDRESS_IMPRECISE" | "DELIVERY_UNAVAILABLE";

export interface DeliveryQuoteDTO {
  deliverable: boolean;
  reason: DeliveryRefusalReason | null;
  zone: DeliveryZoneDTO | null;
  route: { distanceMeters: number; durationSeconds: number; source: "routing" | "estimate" } | null;
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
}

/* ------------------------------------------------------------------ */
/* Cart & quote                                                        */
/* ------------------------------------------------------------------ */

export interface CartLineModifierInput {
  modifierId: string;
  quantity: number;
}

export interface CartLineInput {
  lineId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  modifiers: CartLineModifierInput[];
  notes: string | null;
}

export type CartIssueCode =
  | "PRICE_CHANGED"
  | "UNAVAILABLE"
  | "REMOVED"
  | "MODIFIER_UNAVAILABLE"
  | "INVALID_MODIFIERS"
  | "INVALID_VARIANT"
  | "QUANTITY_LIMIT";

export interface CartIssueDTO {
  lineId: string | null;
  productId: string | null;
  code: CartIssueCode;
  message: string;
  previousPriceCents?: Cents;
  currentPriceCents?: Cents;
}

export interface QuotedLineModifierDTO {
  modifierId: string;
  groupName: string;
  name: string;
  quantity: number;
  unitPriceCents: Cents;
}

export interface QuotedLineDTO {
  lineId: string;
  productId: string;
  variantId: string | null;
  variantName: string | null;
  name: string;
  image: ImageDTO | null;
  quantity: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
  modifiers: QuotedLineModifierDTO[];
  notes: string | null;
  isAvailable: boolean;
}

export interface OrderTotalsDTO {
  subtotalCents: Cents;
  discountCents: Cents;
  deliveryFeeCents: Cents;
  serviceFeeCents: Cents;
  tipCents: Cents;
  /** VAT included in the total (Italian consumer prices are VAT inclusive). */
  taxCents: Cents;
  totalCents: Cents;
}

export interface AppliedCouponDTO {
  code: string | null;
  name: string;
  type: CouponType;
  discountCents: Cents;
  automatic: boolean;
}

export type CheckoutBlocker =
  | "EMPTY_CART"
  | "ADDRESS_REQUIRED"
  | "CART_ISSUES"
  | "BELOW_MINIMUM"
  | "OUT_OF_ZONE"
  | "RESTAURANT_CLOSED"
  | "ORDERS_PAUSED"
  | "FULFILLMENT_UNAVAILABLE"
  | "SLOT_UNAVAILABLE";

export interface CartQuoteDTO {
  lines: QuotedLineDTO[];
  issues: CartIssueDTO[];
  totals: OrderTotalsDTO;
  coupon: AppliedCouponDTO | null;
  couponError: string | null;
  delivery: DeliveryQuoteDTO | null;
  minimumOrderCents: Cents;
  minimumOrderShortfallCents: Cents;
  freeDeliveryShortfallCents: Cents | null;
  blockers: CheckoutBlocker[];
  canCheckout: boolean;
  quotedAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Orders & tracking                                                   */
/* ------------------------------------------------------------------ */

export type TimelineStepState = "done" | "current" | "upcoming";

export interface TimelineStepDTO {
  key: string;
  label: string;
  state: TimelineStepState;
  at: ISODateString | null;
}

export interface EtaDTO {
  /** Window start/end of the estimated delivery (or ready-for-pickup) time. */
  from: ISODateString;
  to: ISODateString;
  /** Minutes from now to the middle of the window, for "Arriva tra circa N min". */
  minutes: number;
  confidence: "low" | "medium" | "high";
}

export interface OrderItemDTO {
  id: string;
  productId: string | null;
  name: string;
  variantName: string | null;
  quantity: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
  modifiers: { name: string; groupName: string; quantity: number; unitPriceCents: Cents }[];
  notes: string | null;
  allergens: Allergen[];
}

export interface OrderPaymentDTO {
  method: PaymentMethod;
  status: PaymentStatus;
  brand: string | null;
  last4: string | null;
  wallet: string | null;
  refundedCents: Cents;
}

export interface RiderPublicDTO {
  firstName: string;
  avatarUrl: string | null;
  vehicle: string | null;
}

export interface OrderTrackingDTO {
  publicId: string;
  number: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  placedAt: ISODateString;
  scheduledFor: ISODateString | null;
  timeline: TimelineStepDTO[];
  eta: EtaDTO | null;
  items: OrderItemDTO[];
  totals: OrderTotalsDTO;
  payment: OrderPaymentDTO;
  customer: { firstName: string; email: string };
  delivery: {
    addressLine: string;
    destination: GeoPoint;
    status: DeliveryStatus;
    rider: RiderPublicDTO | null;
    /** Exposed only while the order is on its way, never before pickup. */
    liveTrackingActive: boolean;
  } | null;
  restaurant: { name: string; location: GeoPoint; addressLine: string; phone: string | null };
  cancellationReason: string | null;
  canCancel: boolean;
  isClaimable: boolean;
  updatedAt: ISODateString;
}

export interface OrderSummaryDTO {
  id: string;
  publicId: string;
  number: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  placedAt: ISODateString;
  totalCents: Cents;
  itemCount: number;
  previewImage: ImageDTO | null;
  itemsPreview: string;
}

export interface RiderLocationDTO {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  recordedAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export interface CheckoutPaymentDTO {
  provider: "STRIPE" | "DEV" | "CASH";
  clientSecret: string | null;
  publishableKey: string | null;
  amountCents: Cents;
}

export interface CheckoutResultDTO {
  orderId: string;
  publicId: string;
  number: string;
  status: OrderStatus;
  payment: CheckoutPaymentDTO;
  trackingUrl: string;
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

export interface MeDTO {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  firstName: string;
  phone: string | null;
  image: string | null;
  role: Role;
  birthDate: string | null;
  createdAt: ISODateString;
  consents: Record<ConsentType, boolean>;
}

export interface LoyaltySummaryDTO {
  enabled: boolean;
  programName: string;
  points: number;
  lifetimePoints: number;
  tier: { key: string; name: string } | null;
  nextTier: { key: string; name: string; pointsNeeded: number } | null;
  nextReward: { id: string; name: string; pointsCost: number; pointsNeeded: number } | null;
  rewards: LoyaltyRewardDTO[];
  history: {
    id: string;
    type: LoyaltyTransactionType;
    points: number;
    description: string;
    createdAt: ISODateString;
  }[];
}

export interface LoyaltyRewardDTO {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  canRedeem: boolean;
}

export interface CouponPublicDTO {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  type: CouponType;
  valueLabel: string;
  minSubtotalCents: Cents | null;
  validUntil: ISODateString | null;
  automatic: boolean;
  personal: boolean;
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  readAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface SupportTicketDTO {
  id: string;
  reference: string;
  category: SupportCategory;
  status: SupportStatus;
  subject: string;
  createdAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Riders                                                              */
/* ------------------------------------------------------------------ */

export interface RiderSummaryDTO {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  availability: RiderAvailability;
  vehicle: string | null;
  activeDeliveries: number;
  deliveredToday: number;
  tipsTodayCents: Cents;
  lastLocation: (RiderLocationDTO & { stale: boolean }) | null;
}

/* ------------------------------------------------------------------ */
/* Realtime events                                                     */
/* ------------------------------------------------------------------ */

export type RealtimeEvent =
  | {
      type: "order.created";
      orderId: string;
      number: string;
      fulfillmentType: FulfillmentType;
      placedAt: ISODateString;
    }
  | {
      type: "order.updated";
      orderId: string;
      publicId: string;
      status: OrderStatus;
      updatedAt: ISODateString;
    }
  | { type: "order.eta"; orderId: string; publicId: string; eta: EtaDTO | null }
  | { type: "delivery.assigned"; orderId: string; riderId: string }
  | { type: "rider.location"; orderId: string; publicId: string; location: RiderLocationDTO }
  | { type: "rider.status"; riderId: string; availability: RiderAvailability }
  | { type: "catalog.availability"; patches: AvailabilityPatchDTO[] }
  | { type: "catalog.changed"; version: string }
  | { type: "restaurant.status"; acceptingOrders: boolean; isPaused: boolean }
  | { type: "notification"; notification: NotificationDTO }
  | { type: "support.created"; ticketId: string; reference: string; subject: string };

export type RealtimeEventType = RealtimeEvent["type"];
