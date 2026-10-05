/**
 * DTOs of the staff API (`/api/v1/admin`): kitchen display, order management, catalog editing,
 * configuration and analytics. Same conventions as the public DTOs (cents, ISO dates).
 */
import type {
  Cents,
  DeliveryZoneDTO,
  EtaDTO,
  GeoPoint,
  ISODateString,
  ImageDTO,
  RiderLocationDTO,
  ServiceStatusDTO,
} from "./dto";
import type {
  Allergen,
  CouponType,
  DeliveryStatus,
  DeliveryZoneType,
  FulfillmentType,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ProductTag,
  RefundStatus,
  RiderAvailability,
  Role,
  SupportCategory,
  SupportStatus,
} from "./enums";

export type KitchenColumnKey = "NEW" | "ACCEPTED" | "PREPARING" | "READY" | "OUT";

/** Commands staff can run on an order right now (mirrors the domain state machine). */
export type StaffOrderCommand =
  | "CONFIRM"
  | "REJECT"
  | "START_PREPARING"
  | "MARK_READY"
  | "ASSIGN_RIDER"
  | "UNASSIGN_RIDER"
  | "RIDER_TO_RESTAURANT"
  | "PICK_UP"
  | "START_DELIVERY"
  | "DELIVER"
  | "CANCEL"
  | "REFUND_FULL";

/** "PAID" online, "TO_COLLECT" cash, "PENDING" online payment not confirmed yet. */
export type CollectionState = "PAID" | "TO_COLLECT" | "PENDING" | "REFUNDED";

export interface KitchenItemDTO {
  id: string;
  name: string;
  nameZh: string | null;
  posCode: string | null;
  variantName: string | null;
  quantity: number;
  notes: string | null;
  modifiers: { name: string; quantity: number }[];
  allergens: Allergen[];
}

export interface KitchenOrderDTO {
  id: string;
  publicId: string;
  number: string;
  status: OrderStatus;
  column: KitchenColumnKey | null;
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  collection: CollectionState;
  totalCents: Cents;
  placedAt: ISODateString;
  receivedAt: ISODateString | null;
  confirmedAt: ISODateString | null;
  readyAt: ISODateString | null;
  scheduledFor: ISODateString | null;
  prepMinutes: number | null;
  /** When the food should be ready (acceptance + prep time, or the scheduled slot). */
  dueAt: ISODateString | null;
  eta: EtaDTO | null;
  customerName: string;
  customerPhone: string | null;
  addressLine: string | null;
  zoneName: string | null;
  kitchenNotes: string | null;
  items: KitchenItemDTO[];
  itemCount: number;
  rider: { id: string; name: string } | null;
  deliveryStatus: DeliveryStatus | null;
  /** Nobody accepted it within the configured threshold. */
  escalated: boolean;
  commands: StaffOrderCommand[];
}

export interface KitchenBoardDTO {
  orders: KitchenOrderDTO[];
  riders: AdminRiderDTO[];
  settings: {
    prepTimeOptions: number[];
    defaultPrepMinutes: number;
    acceptanceEscalationMinutes: number;
    newOrderSoundEnabled: boolean;
    newOrderSound: string;
    autoAcceptOrders: boolean;
  };
  status: ServiceStatusDTO;
  serverTime: ISODateString;
}

export interface AdminOrderListItemDTO {
  id: string;
  publicId: string;
  number: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  collection: CollectionState;
  placedAt: ISODateString;
  scheduledFor: ISODateString | null;
  customerName: string;
  customerEmail: string;
  totalCents: Cents;
  itemCount: number;
  riderName: string | null;
  zoneName: string | null;
}

export interface AdminPaymentDTO {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amountCents: Cents;
  refundedCents: Cents;
  cardBrand: string | null;
  cardLast4: string | null;
  wallet: string | null;
  providerPaymentId: string | null;
  failureMessage: string | null;
  createdAt: ISODateString;
}

export interface AdminRefundDTO {
  id: string;
  amountCents: Cents;
  reason: string | null;
  status: RefundStatus;
  createdBy: string | null;
  createdAt: ISODateString;
}

export interface AdminOrderHistoryDTO {
  id: string;
  status: OrderStatus;
  command: string;
  actorType: string;
  actorName: string | null;
  note: string | null;
  createdAt: ISODateString;
}

export interface AdminOrderDetailDTO extends KitchenOrderDTO {
  customerEmail: string;
  customerUserId: string | null;
  address: {
    line: string;
    formatted: string | null;
    location: GeoPoint | null;
    staircase: string | null;
    floor: string | null;
    apartment: string | null;
    intercom: string | null;
    riderNotes: string | null;
  } | null;
  routeDistanceMeters: number | null;
  routeDurationSeconds: number | null;
  lines: (Omit<KitchenItemDTO, "modifiers"> & {
    unitPriceCents: Cents;
    lineTotalCents: Cents;
    vatRateBps: number;
    modifiers: { name: string; quantity: number; unitPriceCents: Cents }[];
  })[];
  totals: {
    subtotalCents: Cents;
    discountCents: Cents;
    deliveryFeeCents: Cents;
    serviceFeeCents: Cents;
    tipCents: Cents;
    taxCents: Cents;
    totalCents: Cents;
    /** Same rows as the domain totals: VAT-inclusive gross split into net + VAT per rate. */
    vatBreakdown: { rateBps: number; netCents: Cents; vatCents: Cents; grossCents: Cents }[];
  };
  coupon: { code: string | null; name: string } | null;
  payments: AdminPaymentDTO[];
  refunds: AdminRefundDTO[];
  refundableCents: Cents;
  history: AdminOrderHistoryDTO[];
  riderLocation: RiderLocationDTO | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  emails: { template: string; subject: string; status: string; createdAt: ISODateString }[];
  supportTickets: { id: string; reference: string; status: SupportStatus; subject: string }[];
}

export interface DashboardDTO {
  serverTime: ISODateString;
  status: ServiceStatusDTO;
  pause: { paused: boolean; until: ISODateString | null; reason: string | null };
  today: {
    orders: number;
    revenueCents: Cents;
    averageTicketCents: Cents;
    cancelled: number;
    delivery: number;
    pickup: number;
    avgPrepMinutes: number | null;
    avgDeliveryMinutes: number | null;
    /** Share of delivered orders within the promised window (0..1). */
    onTimeRate: number | null;
    tipsCents: Cents;
  };
  /** Same weekday last week, up to the same time: honest comparison for a restaurant. */
  lastWeek: { orders: number; revenueCents: Cents };
  live: {
    awaitingAcceptance: number;
    preparing: number;
    ready: number;
    outForDelivery: number;
    escalated: number;
  };
  riders: { available: number; busy: number; offline: number };
  latest: AdminOrderListItemDTO[];
  soldOut: { id: string; name: string; availableAgainAt: ISODateString | null }[];
}

export interface AnalyticsDTO {
  from: ISODateString;
  to: ISODateString;
  totals: {
    orders: number;
    revenueCents: Cents;
    averageTicketCents: Cents;
    customers: number;
    newCustomers: number;
    discountsCents: Cents;
    tipsCents: Cents;
    cancelled: number;
    refundedCents: Cents;
  };
  daily: { date: string; orders: number; revenueCents: Cents }[];
  /** Orders per hour of day (restaurant time zone). */
  hourly: { hour: number; orders: number }[];
  weekday: { weekday: number; orders: number; revenueCents: Cents }[];
  topProducts: { productId: string | null; name: string; quantity: number; revenueCents: Cents }[];
  fulfillment: { type: FulfillmentType; orders: number; revenueCents: Cents }[];
  payments: { method: string; orders: number; revenueCents: Cents }[];
  times: {
    avgAcceptMinutes: number | null;
    avgPrepMinutes: number | null;
    avgDeliveryMinutes: number | null;
    onTimeRate: number | null;
  };
  coupons: { code: string | null; name: string; redemptions: number; discountCents: Cents }[];
}

/* ---------------------------------------------------------------- catalog */

export interface AdminVariantDTO {
  id: string;
  name: string;
  priceCents: Cents;
  isAvailable: boolean;
  isDefault: boolean;
}

export interface AdminProductDTO {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  nameZh: string | null;
  description: string | null;
  descriptionZh: string | null;
  ingredients: string[];
  posCode: string | null;
  priceCents: Cents;
  vatRateBps: number;
  isVisible: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
  unavailableUntil: ISODateString | null;
  tags: ProductTag[];
  spicyLevel: number;
  excludedFromDiscounts: boolean;
  allergens: Allergen[];
  mayContainAllergens: Allergen[];
  allergensDeclared: boolean;
  maxQuantityPerLine: number;
  modifierGroupIds: string[];
  variants: AdminVariantDTO[];
  images: (ImageDTO & { id: string })[];
  position: number;
  source: { provider: string | null; id: string | null };
  updatedAt: ISODateString;
}

export interface AdminCategoryDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isVisible: boolean;
  position: number;
  productIds: string[];
}

export interface AdminModifierGroupDTO {
  id: string;
  name: string;
  description: string | null;
  minSelect: number;
  maxSelect: number;
  maxTotalQuantity: number;
  isActive: boolean;
  options: {
    id: string;
    name: string;
    priceDeltaCents: Cents;
    isAvailable: boolean;
    maxQuantity: number;
    allergens: Allergen[];
  }[];
  productCount: number;
}

export interface AdminCatalogDTO {
  categories: AdminCategoryDTO[];
  products: Record<string, AdminProductDTO>;
  modifierGroups: AdminModifierGroupDTO[];
}

/* ---------------------------------------------------------------- configuration */

export interface AdminHoursDTO {
  venue: { weekday: number; opensAt: string; closesAt: string }[];
  delivery: { weekday: number; opensAt: string; closesAt: string }[];
  pickup: { weekday: number; opensAt: string; closesAt: string }[];
  closures: {
    id: string;
    startsAt: ISODateString;
    endsAt: ISODateString;
    reason: string | null;
    appliesTo: FulfillmentType[];
    isHoliday: boolean;
  }[];
  timezone: string;
}

export interface AdminZoneDTO extends DeliveryZoneDTO {
  isActive: boolean;
  priority: number;
  etaAdjustmentMinutes: number;
  polygon: GeoPoint[] | null;
  center: GeoPoint | null;
  radiusMeters: number | null;
  minDistanceMeters: number | null;
  maxDistanceMeters: number | null;
  color: string | null;
  type: DeliveryZoneType;
}

/* ---------------------------------------------------------------- people */

export interface AdminRiderDTO {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  vehicle: string | null;
  isActive: boolean;
  availability: RiderAvailability;
  activeDeliveries: { orderId: string; number: string; status: DeliveryStatus }[];
  deliveredToday: number;
  tipsTodayCents: Cents;
  cashToReturnCents: Cents;
  lastSeenAt: ISODateString | null;
  location: (GeoPoint & { at: ISODateString; stale: boolean }) | null;
}

export interface AdminCustomerListItemDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: ISODateString;
  ordersCount: number;
  totalSpentCents: Cents;
  lastOrderAt: ISODateString | null;
  segment: string;
  marketingEmail: boolean;
}

export interface AdminCustomerDetailDTO extends AdminCustomerListItemDTO {
  emailVerified: boolean;
  loyaltyPoints: number;
  addresses: string[];
  orders: AdminOrderListItemDTO[];
  consents: { type: string; granted: boolean; source: string; createdAt: ISODateString }[];
}

export interface AdminStaffDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  disabled: boolean;
  createdAt: ISODateString;
  lastSessionAt: ISODateString | null;
}

export interface AdminCouponDTO {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  type: CouponType;
  percentBps: number | null;
  amountCents: Cents | null;
  maxDiscountCents: Cents | null;
  minSubtotalCents: Cents | null;
  startsAt: ISODateString | null;
  endsAt: ISODateString | null;
  isActive: boolean;
  autoApply: boolean;
  isPublic: boolean;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  fulfillmentTypes: FulfillmentType[];
  newCustomersOnly: boolean;
  includedProductIds: string[];
  includedCategoryIds: string[];
  redemptionsCount: number;
  personal: boolean;
  valueLabel: string;
  createdAt: ISODateString;
}

export interface AdminSupportTicketDTO {
  id: string;
  reference: string;
  category: SupportCategory;
  status: SupportStatus;
  subject: string;
  name: string;
  email: string;
  phone: string | null;
  order: { id: string; publicId: string; number: string } | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastMessagePreview: string;
  messages?: {
    id: string;
    fromStaff: boolean;
    authorName: string | null;
    body: string;
    createdAt: ISODateString;
  }[];
}

export interface AuditEntryDTO {
  id: string;
  actorName: string | null;
  actorRole: Role | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: ISODateString;
}
