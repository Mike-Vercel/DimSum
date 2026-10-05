/**
 * Typed client for the DIMSUM REST API (/api/v1).
 *
 * Used by the web app today and designed for the React Native/Expo app tomorrow:
 *  - web: same-origin cookies (`credentials: "include"`)
 *  - native: `getToken` returns the Better Auth bearer token stored in SecureStore
 */
import type {
  AddressSuggestionDTO,
  AdminCatalogDTO,
  AdminCouponDTO,
  AdminCustomerDetailDTO,
  AdminCustomerListItemDTO,
  AdminHoursDTO,
  AdminModifierGroupDTO,
  AdminOrderDetailDTO,
  AdminOrderListItemDTO,
  AdminProductDTO,
  AdminRiderDTO,
  AdminStaffDTO,
  AdminSupportTicketDTO,
  AdminZoneDTO,
  AnalyticsDTO,
  AuditEntryDTO,
  AvailabilityPatchDTO,
  DashboardDTO,
  KitchenBoardDTO,
  LoyaltyRewardDTO,
  ApiErrorBody,
  CartLineInput,
  CartQuoteDTO,
  CatalogDTO,
  CheckoutResultDTO,
  CouponPublicDTO,
  DaySlotsDTO,
  DeliveryQuoteDTO,
  GeocodedAddressDTO,
  LoyaltySummaryDTO,
  MeDTO,
  NotificationDTO,
  OrderSummaryDTO,
  OrderTrackingDTO,
  Paginated,
  ProductDTO,
  RestaurantPublicDTO,
  RiderHomeDTO,
  RiderLocationDTO,
  SavedAddressDTO,
  ServiceStatusDTO,
  SupportTicketDTO,
} from "@dimsum/types";
import type { z } from "zod";
import type {
  accountCartSync,
  adminOrdersQuery,
  availabilityBatchInput,
  categoryInput,
  closureInput,
  couponInput,
  deliveryZoneInput,
  loyaltyAdjustInput,
  loyaltyConfigInput,
  loyaltyRewardInput,
  modifierGroupInput,
  openingHoursInput,
  orderCommandRequest,
  pauseOrdersInput,
  productInput,
  refundRequest,
  riderInput,
  riderUpdateInput,
  settingsInput,
  staffInput,
  staffUpdateInput,
  supportReplyInput,
  cartQuoteRequest,
  checkoutRequest,
  deliveryQuoteRequest,
  deviceTokenInput,
  pushSubscriptionInput,
  riderDeliveryAction,
  riderLocationInput,
  savedAddressInput,
  supportTicketInput,
  updateConsents,
  updateProfile,
} from "@dimsum/validation";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: Record<string, string[]> | undefined;
  readonly details: unknown;

  constructor(status: number, body: ApiErrorBody["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors;
    this.details = body.details;
  }

  get isNetwork() {
    return this.code === "NETWORK";
  }
}

export interface ApiClientOptions {
  /** e.g. "https://dimsum.it/api/v1" (native) or "/api/v1" (web). */
  baseUrl: string;
  getToken?: () => Promise<string | null> | string | null;
  fetch?: typeof fetch;
  /** Extra headers on every call (app version, platform…). */
  headers?: () => Record<string, string>;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? fetch;

  async function request<T>(
    method: Method,
    path: string,
    body?: unknown,
    init: { signal?: AbortSignal; idempotencyKey?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", ...(options.headers?.() ?? {}) };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
    const token = options.getToken ? await options.getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await doFetch(`${options.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: options.getToken ? "omit" : "include",
        signal: init.signal,
      });
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw error;
      throw new ApiError(0, {
        code: "NETWORK",
        message: "Connessione assente o instabile. Controlla la rete e riprova.",
      });
    }

    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const err = (data as ApiErrorBody | null)?.error ?? {
        code: "HTTP_" + res.status,
        message: "Si è verificato un errore. Riprova.",
      };
      throw new ApiError(res.status, err);
    }
    return data as T;
  }

  const qs = (params: Record<string, string | number | undefined | null>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
      if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
    const str = s.toString();
    return str ? `?${str}` : "";
  };

  return {
    request,
    restaurant: {
      get: (signal?: AbortSignal) =>
        request<RestaurantPublicDTO>("GET", "/restaurant", undefined, { signal }),
      status: (signal?: AbortSignal) =>
        request<ServiceStatusDTO>("GET", "/restaurant/status", undefined, { signal }),
      slots: (fulfillmentType: "DELIVERY" | "PICKUP") =>
        request<{ days: DaySlotsDTO[] }>("GET", `/restaurant/slots${qs({ fulfillmentType })}`),
    },
    catalog: {
      get: (signal?: AbortSignal) => request<CatalogDTO>("GET", "/catalog", undefined, { signal }),
      product: (slug: string) => request<ProductDTO>("GET", `/catalog/products/${encodeURIComponent(slug)}`),
      search: (q: string, signal?: AbortSignal) =>
        request<{ results: ProductDTO[] }>("GET", `/catalog/search${qs({ q })}`, undefined, { signal }),
    },
    cart: {
      quote: (input: z.input<typeof cartQuoteRequest>, signal?: AbortSignal) =>
        request<CartQuoteDTO>("POST", "/cart/quote", input, { signal }),
      getAccountCart: () => request<{ lines: CartLineInput[]; couponCode: string | null }>("GET", "/me/cart"),
      saveAccountCart: (input: z.input<typeof accountCartSync>) =>
        request<{ ok: true }>("PUT", "/me/cart", input),
    },
    geo: {
      suggest: (q: string, session?: string, signal?: AbortSignal) =>
        request<{ suggestions: AddressSuggestionDTO[] }>(
          "GET",
          `/geo/suggest${qs({ q, session })}`,
          undefined,
          { signal },
        ),
      details: (id: string, session?: string) =>
        request<{ address: GeocodedAddressDTO }>("GET", `/geo/place${qs({ id, session })}`),
      reverse: (lat: number, lng: number) =>
        request<{ address: GeocodedAddressDTO | null }>("GET", `/geo/reverse${qs({ lat, lng })}`),
    },
    delivery: {
      quote: (input: z.input<typeof deliveryQuoteRequest>) =>
        request<DeliveryQuoteDTO>("POST", "/delivery/quote", input),
    },
    checkout: {
      placeOrder: (input: z.input<typeof checkoutRequest>) =>
        request<CheckoutResultDTO>("POST", "/checkout/orders", input, {
          idempotencyKey: input.idempotencyKey,
        }),
      simulatePayment: (publicId: string, outcome: "succeed" | "fail") =>
        request<{ ok: true }>("POST", `/dev/payments/${encodeURIComponent(publicId)}`, { outcome }),
    },
    orders: {
      track: (publicId: string, signal?: AbortSignal) =>
        request<OrderTrackingDTO>("GET", `/orders/${encodeURIComponent(publicId)}`, undefined, { signal }),
      riderLocation: (publicId: string) =>
        request<{ location: RiderLocationDTO | null }>(
          "GET",
          `/orders/${encodeURIComponent(publicId)}/rider-location`,
        ),
      routeGeometry: (publicId: string) =>
        request<{ geometry: [number, number][] | null }>(
          "GET",
          `/orders/${encodeURIComponent(publicId)}/route-geometry`,
        ),
      cancel: (publicId: string, reason: string) =>
        request<OrderTrackingDTO>("POST", `/orders/${encodeURIComponent(publicId)}/cancel`, { reason }),
      claim: (publicId: string) =>
        request<{ ok: true }>("POST", `/orders/${encodeURIComponent(publicId)}/claim`, {}),
      paymentIntent: (publicId: string) =>
        request<{ clientSecret: string | null; status: string }>(
          "GET",
          `/orders/${encodeURIComponent(publicId)}/payment`,
        ),
    },
    me: {
      get: () => request<MeDTO>("GET", "/me"),
      update: (input: z.input<typeof updateProfile>) => request<MeDTO>("PATCH", "/me", input),
      consents: (input: z.input<typeof updateConsents>) => request<MeDTO>("PUT", "/me/consents", input),
      orders: (cursor?: string, status?: "active" | "history" | "all") =>
        request<Paginated<OrderSummaryDTO>>("GET", `/me/orders${qs({ cursor, status })}`),
      reorder: (orderId: string) =>
        request<{ lines: CartLineInput[]; unavailable: string[]; changedPrices: string[] }>(
          "POST",
          `/me/orders/${orderId}/reorder`,
          {},
        ),
      addresses: {
        list: () => request<{ addresses: SavedAddressDTO[] }>("GET", "/me/addresses"),
        create: (input: z.input<typeof savedAddressInput>) =>
          request<SavedAddressDTO>("POST", "/me/addresses", input),
        update: (id: string, input: z.input<typeof savedAddressInput>) =>
          request<SavedAddressDTO>("PUT", `/me/addresses/${id}`, input),
        remove: (id: string) => request<{ ok: true }>("DELETE", `/me/addresses/${id}`),
      },
      favorites: {
        list: () => request<{ productIds: string[] }>("GET", "/me/favorites"),
        add: (productId: string) => request<{ ok: true }>("PUT", `/me/favorites/${productId}`, {}),
        remove: (productId: string) => request<{ ok: true }>("DELETE", `/me/favorites/${productId}`),
      },
      coupons: () => request<{ coupons: CouponPublicDTO[] }>("GET", "/me/coupons"),
      loyalty: () => request<LoyaltySummaryDTO>("GET", "/me/loyalty"),
      redeemReward: (rewardId: string) =>
        request<{ coupon: CouponPublicDTO }>("POST", "/me/loyalty/redeem", { rewardId }),
      notifications: (cursor?: string) =>
        request<Paginated<NotificationDTO> & { unread: number }>("GET", `/me/notifications${qs({ cursor })}`),
      markNotificationsRead: (ids?: string[]) =>
        request<{ ok: true }>("POST", "/me/notifications/read", ids ? { ids } : {}),
      exportData: () => request<Record<string, unknown>>("GET", "/me/export"),
      deleteAccount: () => request<{ ok: true }>("DELETE", "/me", { confirmation: "ELIMINA" }),
      devices: {
        register: (input: z.input<typeof deviceTokenInput>) =>
          request<{ ok: true }>("POST", "/me/devices", input),
        unregister: (token: string) => request<{ ok: true }>("DELETE", `/me/devices${qs({ token })}`),
      },
    },
    offers: {
      list: () => request<{ coupons: CouponPublicDTO[] }>("GET", "/offers"),
    },
    support: {
      create: (input: z.input<typeof supportTicketInput>) =>
        request<SupportTicketDTO>("POST", "/support/tickets", input),
    },
    /** Rider app: shift, deliveries and live position during deliveries. */
    rider: {
      home: (signal?: AbortSignal) => request<RiderHomeDTO>("GET", "/rider/me", undefined, { signal }),
      setOnline: (online: boolean) => request<RiderHomeDTO>("PUT", "/rider/availability", { online }),
      action: (orderId: string, input: z.input<typeof riderDeliveryAction>) =>
        request<RiderHomeDTO>("POST", `/rider/deliveries/${orderId}/actions`, input),
      location: (input: z.input<typeof riderLocationInput>) =>
        request<{ tracking: boolean }>("POST", "/rider/location", input),
    },
    /** Staff API (kitchen display, admin panel, future native admin). */
    admin: {
      kitchen: (signal?: AbortSignal) =>
        request<KitchenBoardDTO>("GET", "/admin/kitchen", undefined, { signal }),
      dashboard: (signal?: AbortSignal) =>
        request<DashboardDTO>("GET", "/admin/dashboard", undefined, { signal }),
      pause: (input: z.input<typeof pauseOrdersInput>) =>
        request<DashboardDTO>("POST", "/admin/pause", input),
      orders: {
        list: (
          query: {
            status?: string;
            fulfillmentType?: "DELIVERY" | "PICKUP";
            q?: string;
            from?: string;
            to?: string;
            cursor?: string;
            limit?: number;
          } = {},
        ) => request<Paginated<AdminOrderListItemDTO>>("GET", `/admin/orders${qs(query)}`),
        get: (id: string, signal?: AbortSignal) =>
          request<AdminOrderDetailDTO>("GET", `/admin/orders/${id}`, undefined, { signal }),
        command: (id: string, input: z.input<typeof orderCommandRequest>) =>
          request<AdminOrderDetailDTO>("POST", `/admin/orders/${id}/commands`, input),
        refund: (id: string, input: z.input<typeof refundRequest>) =>
          request<AdminOrderDetailDTO>("POST", `/admin/orders/${id}/refunds`, input),
      },
      catalog: {
        get: () => request<AdminCatalogDTO>("GET", "/admin/catalog"),
        availability: (input: z.input<typeof availabilityBatchInput>) =>
          request<{ patches: AvailabilityPatchDTO[] }>("POST", "/admin/products/availability", input),
        createProduct: (input: z.input<typeof productInput>) =>
          request<AdminProductDTO>("POST", "/admin/products", input),
        updateProduct: (id: string, input: z.input<typeof productInput>) =>
          request<AdminProductDTO>("PUT", `/admin/products/${id}`, input),
        deleteProduct: (id: string) => request<{ ok: true }>("DELETE", `/admin/products/${id}`),
        deletePhoto: (id: string, imageId: string) =>
          request<AdminProductDTO>("DELETE", `/admin/products/${id}/photos/${imageId}`),
        createCategory: (input: z.input<typeof categoryInput>) =>
          request<AdminCatalogDTO>("POST", "/admin/categories", input),
        updateCategory: (id: string, input: z.input<typeof categoryInput>) =>
          request<AdminCatalogDTO>("PUT", `/admin/categories/${id}`, input),
        deleteCategory: (id: string) => request<AdminCatalogDTO>("DELETE", `/admin/categories/${id}`),
        reorderCategories: (ids: string[]) =>
          request<AdminCatalogDTO>("PUT", "/admin/categories/order", { ids }),
        reorderProducts: (categoryId: string, ids: string[]) =>
          request<AdminCatalogDTO>("PUT", `/admin/categories/${categoryId}/products`, { ids }),
        createGroup: (input: z.input<typeof modifierGroupInput>) =>
          request<AdminModifierGroupDTO>("POST", "/admin/modifier-groups", input),
        updateGroup: (id: string, input: z.input<typeof modifierGroupInput>) =>
          request<AdminModifierGroupDTO>("PUT", `/admin/modifier-groups/${id}`, input),
      },
      settings: {
        get: () => request<AdminSettingsResponse>("GET", "/admin/settings"),
        update: (input: z.input<typeof settingsInput>) =>
          request<AdminSettingsResponse>("PUT", "/admin/settings", input),
      },
      hours: {
        get: () => request<AdminHoursDTO>("GET", "/admin/hours"),
        replace: (input: z.input<typeof openingHoursInput>) =>
          request<AdminHoursDTO>("PUT", "/admin/hours", input),
        addClosure: (input: z.input<typeof closureInput>) =>
          request<AdminHoursDTO>("POST", "/admin/closures", input),
        removeClosure: (id: string) => request<AdminHoursDTO>("DELETE", `/admin/closures/${id}`),
      },
      zones: {
        list: () => request<{ zones: AdminZoneDTO[] }>("GET", "/admin/zones"),
        create: (input: z.input<typeof deliveryZoneInput>) =>
          request<AdminZoneDTO>("POST", "/admin/zones", input),
        update: (id: string, input: z.input<typeof deliveryZoneInput>) =>
          request<AdminZoneDTO>("PUT", `/admin/zones/${id}`, input),
        remove: (id: string) => request<{ ok: true }>("DELETE", `/admin/zones/${id}`),
      },
      riders: {
        list: () => request<{ riders: AdminRiderDTO[] }>("GET", "/admin/riders"),
        create: (input: z.input<typeof riderInput>) =>
          request<{ riderId: string; invited: boolean }>("POST", "/admin/riders", input),
        update: (id: string, input: z.input<typeof riderUpdateInput>) =>
          request<{ riders: AdminRiderDTO[] }>("PATCH", `/admin/riders/${id}`, input),
        resendInvite: (id: string) => request<{ ok: true }>("POST", `/admin/riders/${id}/invite`, {}),
      },
      coupons: {
        list: () => request<{ coupons: AdminCouponDTO[] }>("GET", "/admin/coupons"),
        create: (input: z.input<typeof couponInput>) =>
          request<AdminCouponDTO>("POST", "/admin/coupons", input),
        update: (id: string, input: z.input<typeof couponInput>) =>
          request<AdminCouponDTO>("PUT", `/admin/coupons/${id}`, input),
        archive: (id: string) => request<{ ok: true }>("DELETE", `/admin/coupons/${id}`),
      },
      loyalty: {
        get: () => request<AdminLoyaltyResponse>("GET", "/admin/loyalty"),
        update: (input: z.input<typeof loyaltyConfigInput>) =>
          request<AdminLoyaltyResponse>("PUT", "/admin/loyalty", input),
        createReward: (input: z.input<typeof loyaltyRewardInput>) =>
          request<AdminLoyaltyResponse>("POST", "/admin/loyalty/rewards", input),
        updateReward: (id: string, input: z.input<typeof loyaltyRewardInput>) =>
          request<AdminLoyaltyResponse>("PUT", `/admin/loyalty/rewards/${id}`, input),
        adjust: (input: z.input<typeof loyaltyAdjustInput>) =>
          request<{ ok: true }>("POST", "/admin/loyalty/adjust", input),
      },
      customers: {
        list: (q?: string, cursor?: string) =>
          request<Paginated<AdminCustomerListItemDTO>>("GET", `/admin/customers${qs({ q, cursor })}`),
        get: (id: string) => request<AdminCustomerDetailDTO>("GET", `/admin/customers/${id}`),
      },
      analytics: (range: "today" | "7d" | "30d" | "custom", from?: string, to?: string) =>
        request<AnalyticsDTO>("GET", `/admin/analytics${qs({ range, from, to })}`),
      support: {
        list: (status?: "open" | "closed", cursor?: string) =>
          request<Paginated<AdminSupportTicketDTO> & { openCount: number }>(
            "GET",
            `/admin/support${qs({ status, cursor })}`,
          ),
        get: (id: string) => request<AdminSupportTicketDTO>("GET", `/admin/support/${id}`),
        reply: (id: string, input: z.input<typeof supportReplyInput>) =>
          request<AdminSupportTicketDTO>("POST", `/admin/support/${id}/replies`, input),
        setStatus: (id: string, status: AdminSupportTicketDTO["status"]) =>
          request<AdminSupportTicketDTO>("PATCH", `/admin/support/${id}`, { status }),
      },
      staff: {
        list: () => request<{ staff: AdminStaffDTO[] }>("GET", "/admin/staff"),
        create: (input: z.input<typeof staffInput>) =>
          request<{ staff: AdminStaffDTO[] }>("POST", "/admin/staff", input),
        update: (id: string, input: z.input<typeof staffUpdateInput>) =>
          request<{ staff: AdminStaffDTO[] }>("PATCH", `/admin/staff/${id}`, input),
      },
      audit: (cursor?: string, entityType?: string, entityId?: string) =>
        request<Paginated<AuditEntryDTO>>("GET", `/admin/audit${qs({ cursor, entityType, entityId })}`),
    },
    push: {
      subscribe: (input: z.input<typeof pushSubscriptionInput>) =>
        request<{ ok: true }>("POST", "/push/subscriptions", input),
      unsubscribe: (endpoint: string) =>
        request<{ ok: true }>("DELETE", `/push/subscriptions${qs({ endpoint })}`),
    },
  };
}

export interface AdminLoyaltyResponse {
  config: {
    enabled: boolean;
    programName: string;
    pointsPerEuro: number;
    tiers: { key: string; name: string; minLifetimePoints: number; multiplierBps: number }[];
    expiryMonths: number | null;
    birthdayBonusPoints: number;
    signupBonusPoints: number;
  };
  rewards: (LoyaltyRewardDTO & {
    couponType: string;
    percentBps: number | null;
    amountCents: number | null;
    validDays: number;
    isActive: boolean;
  })[];
  members: number;
}

/** Restaurant settings as edited in "Impostazioni" (same shape as the settings input, plus derived data). */
export type AdminSettingsResponse = z.output<typeof settingsInput> & {
  timezone: string;
  ordersPaused: boolean;
  pausedUntil: string | null;
  pauseReason: string | null;
};

export type ApiClient = ReturnType<typeof createApiClient>;
