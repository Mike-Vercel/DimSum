/**
 * Application errors. `message` is always safe to show to customers (Italian, no internals);
 * technical details go to the logs only.
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "RESTAURANT_CLOSED"
  | "ORDERS_PAUSED"
  | "OUT_OF_ZONE"
  | "BELOW_MINIMUM"
  | "PRICE_CHANGED"
  | "PRODUCT_UNAVAILABLE"
  | "CART_INVALID"
  | "SLOT_UNAVAILABLE"
  | "COUPON_INVALID"
  | "PAYMENT_FAILED"
  | "PAYMENT_UNAVAILABLE"
  | "INVALID_TRANSITION"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  RESTAURANT_CLOSED: 409,
  ORDERS_PAUSED: 409,
  OUT_OF_ZONE: 422,
  BELOW_MINIMUM: 422,
  PRICE_CHANGED: 409,
  PRODUCT_UNAVAILABLE: 409,
  CART_INVALID: 422,
  SLOT_UNAVAILABLE: 409,
  COUPON_INVALID: 422,
  PAYMENT_FAILED: 402,
  PAYMENT_UNAVAILABLE: 503,
  INVALID_TRANSITION: 409,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL: 500,
};

const DEFAULT_MESSAGE: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: "Accedi per continuare.",
  FORBIDDEN: "Non hai i permessi per questa operazione.",
  NOT_FOUND: "Non abbiamo trovato quello che cerchi.",
  RATE_LIMITED: "Troppe richieste ravvicinate. Riprova tra qualche istante.",
  SERVICE_UNAVAILABLE: "Il servizio è momentaneamente non disponibile. Riprova tra poco.",
  INTERNAL: "Si è verificato un errore imprevisto. Riprova tra qualche istante.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly fieldErrors: Record<string, string[]> | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: ErrorCode,
    message?: string,
    options: {
      details?: unknown;
      fieldErrors?: Record<string, string[]>;
      cause?: unknown;
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(message ?? DEFAULT_MESSAGE[code] ?? "Richiesta non valida.", { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = options.details;
    this.fieldErrors = options.fieldErrors;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** "Ordine non trovato." — pass a masculine noun, or build the AppError directly for other wording. */
export const notFound = (what = "Elemento") => new AppError("NOT_FOUND", `${what} non trovato.`);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
