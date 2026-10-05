/**
 * Domain enums shared by every client (web, PWA, rider app, future native apps).
 * Values are kept identical to the PostgreSQL enums defined in `@dimsum/db`.
 */

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as T[keyof T][];

export const Role = {
  CUSTOMER: "CUSTOMER",
  RIDER: "RIDER",
  STAFF: "STAFF",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = values(Role);

export const FulfillmentType = {
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
} as const;
export type FulfillmentType = (typeof FulfillmentType)[keyof typeof FulfillmentType];
export const FULFILLMENT_TYPES = values(FulfillmentType);

export const OrderStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAID: "PAID",
  RECEIVED: "RECEIVED",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  RIDER_ASSIGNED: "RIDER_ASSIGNED",
  RIDER_TO_RESTAURANT: "RIDER_TO_RESTAURANT",
  PICKED_UP: "PICKED_UP",
  ON_THE_WAY: "ON_THE_WAY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const ORDER_STATUSES = values(OrderStatus);

export const PaymentMethod = {
  /** Stripe Payment Element: card, Apple Pay, Google Pay. */
  ONLINE: "ONLINE",
  CASH_ON_DELIVERY: "CASH_ON_DELIVERY",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export const PAYMENT_METHODS = values(PaymentMethod);

export const PaymentProvider = {
  STRIPE: "STRIPE",
  /** Local test simulator. Refused at runtime in production. */
  DEV: "DEV",
  CASH: "CASH",
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentStatus = {
  PENDING: "PENDING",
  REQUIRES_ACTION: "REQUIRES_ACTION",
  PROCESSING: "PROCESSING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const RefundStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

export const DeliveryStatus = {
  UNASSIGNED: "UNASSIGNED",
  ASSIGNED: "ASSIGNED",
  TO_RESTAURANT: "TO_RESTAURANT",
  AT_RESTAURANT: "AT_RESTAURANT",
  PICKED_UP: "PICKED_UP",
  ON_THE_WAY: "ON_THE_WAY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const RiderAvailability = {
  OFFLINE: "OFFLINE",
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY",
} as const;
export type RiderAvailability = (typeof RiderAvailability)[keyof typeof RiderAvailability];

export const DeliveryZoneType = {
  /** Point-in-polygon on the geocoded address. */
  POLYGON: "POLYGON",
  /** Geodesic radius around a centre (kept for zones imported from the previous platform). */
  CIRCLE: "CIRCLE",
  /** Band on the real route distance from the restaurant (e.g. 0–2 km, 2–4 km). */
  DISTANCE_BAND: "DISTANCE_BAND",
} as const;
export type DeliveryZoneType = (typeof DeliveryZoneType)[keyof typeof DeliveryZoneType];

export const CouponType = {
  PERCENTAGE: "PERCENTAGE",
  FIXED_AMOUNT: "FIXED_AMOUNT",
  FREE_DELIVERY: "FREE_DELIVERY",
} as const;
export type CouponType = (typeof CouponType)[keyof typeof CouponType];

export const LoyaltyTransactionType = {
  EARN: "EARN",
  REDEEM: "REDEEM",
  BONUS: "BONUS",
  ADJUST: "ADJUST",
  EXPIRE: "EXPIRE",
  REVERSAL: "REVERSAL",
} as const;
export type LoyaltyTransactionType = (typeof LoyaltyTransactionType)[keyof typeof LoyaltyTransactionType];

export const NotificationChannel = {
  IN_APP: "IN_APP",
  EMAIL: "EMAIL",
  WEB_PUSH: "WEB_PUSH",
  NATIVE_PUSH: "NATIVE_PUSH",
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationCategory = {
  /** Order lifecycle messages: always allowed (contract execution). */
  TRANSACTIONAL: "TRANSACTIONAL",
  /** Promotions: only with explicit, recorded consent. */
  MARKETING: "MARKETING",
  /** Staff/rider operational alerts. */
  OPERATIONAL: "OPERATIONAL",
} as const;
export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NotificationType = {
  ORDER_RECEIVED: "ORDER_RECEIVED",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
  ORDER_PREPARING: "ORDER_PREPARING",
  ORDER_READY: "ORDER_READY",
  RIDER_ASSIGNED: "RIDER_ASSIGNED",
  ORDER_PICKED_UP: "ORDER_PICKED_UP",
  RIDER_NEARBY: "RIDER_NEARBY",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  REFUND_ISSUED: "REFUND_ISSUED",
  ETA_UPDATED: "ETA_UPDATED",
  NEW_ORDER: "NEW_ORDER",
  ORDER_ESCALATION: "ORDER_ESCALATION",
  DELIVERY_ASSIGNED: "DELIVERY_ASSIGNED",
  PROMOTION: "PROMOTION",
  LOYALTY: "LOYALTY",
  SUPPORT_REPLY: "SUPPORT_REPLY",
  SUPPORT_REQUEST: "SUPPORT_REQUEST",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const ConsentType = {
  TERMS: "TERMS",
  PRIVACY: "PRIVACY",
  MARKETING_EMAIL: "MARKETING_EMAIL",
  MARKETING_PUSH: "MARKETING_PUSH",
  PERSONALIZATION: "PERSONALIZATION",
  ANALYTICS: "ANALYTICS",
} as const;
export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType];
export const CONSENT_TYPES = values(ConsentType);

export const OpeningHourKind = {
  /** Venue opening hours shown to customers. */
  VENUE: "VENUE",
  /** Window in which delivery orders can be fulfilled. */
  DELIVERY: "DELIVERY",
  /** Window in which pickup orders can be fulfilled. */
  PICKUP: "PICKUP",
} as const;
export type OpeningHourKind = (typeof OpeningHourKind)[keyof typeof OpeningHourKind];

/** The 14 allergens of EU Regulation 1169/2011, Annex II. */
export const Allergen = {
  GLUTEN: "GLUTEN",
  CRUSTACEANS: "CRUSTACEANS",
  EGGS: "EGGS",
  FISH: "FISH",
  PEANUTS: "PEANUTS",
  SOYBEANS: "SOYBEANS",
  MILK: "MILK",
  NUTS: "NUTS",
  CELERY: "CELERY",
  MUSTARD: "MUSTARD",
  SESAME: "SESAME",
  SULPHITES: "SULPHITES",
  LUPIN: "LUPIN",
  MOLLUSCS: "MOLLUSCS",
} as const;
export type Allergen = (typeof Allergen)[keyof typeof Allergen];
export const ALLERGENS = values(Allergen);

export const ProductTag = {
  VEGETARIAN: "VEGETARIAN",
  VEGAN: "VEGAN",
  SPICY: "SPICY",
  NEW: "NEW",
  BESTSELLER: "BESTSELLER",
  CONTAINS_COLOURANTS: "CONTAINS_COLOURANTS",
  ALCOHOLIC: "ALCOHOLIC",
} as const;
export type ProductTag = (typeof ProductTag)[keyof typeof ProductTag];
export const PRODUCT_TAGS = values(ProductTag);

export const SupportCategory = {
  ORDER_ISSUE: "ORDER_ISSUE",
  PAYMENT: "PAYMENT",
  DELIVERY: "DELIVERY",
  MISSING_ITEM: "MISSING_ITEM",
  OTHER: "OTHER",
} as const;
export type SupportCategory = (typeof SupportCategory)[keyof typeof SupportCategory];
export const SUPPORT_CATEGORIES = values(SupportCategory);

export const SupportStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;
export type SupportStatus = (typeof SupportStatus)[keyof typeof SupportStatus];

export const ImageBackdrop = {
  DARK: "DARK",
  LIGHT: "LIGHT",
} as const;
export type ImageBackdrop = (typeof ImageBackdrop)[keyof typeof ImageBackdrop];

export const CustomerSegment = {
  NEW: "NEW",
  OCCASIONAL: "OCCASIONAL",
  REGULAR: "REGULAR",
  INACTIVE: "INACTIVE",
} as const;
export type CustomerSegment = (typeof CustomerSegment)[keyof typeof CustomerSegment];

export const DevicePlatform = {
  WEB: "WEB",
  IOS: "IOS",
  ANDROID: "ANDROID",
} as const;
export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];
