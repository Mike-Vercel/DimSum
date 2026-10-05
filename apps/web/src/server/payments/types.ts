export interface CreateIntentInput {
  amountCents: number;
  currency: "eur";
  idempotencyKey: string;
  orderId: string;
  publicId: string;
  orderNumber: string;
  email: string;
  description: string;
}

export interface CreatedIntent {
  providerPaymentId: string;
  clientSecret: string | null;
}

export interface RefundInput {
  providerPaymentId: string;
  amountCents: number;
  idempotencyKey: string;
  reason: string;
}

/**
 * Online payment gateway. Card data never touches our servers: the client confirms the payment
 * directly with the provider and the order is marked paid only by a verified server-side event.
 */
export interface PaymentGateway {
  readonly name: "STRIPE" | "DEV";
  createIntent(input: CreateIntentInput): Promise<CreatedIntent>;
  /** Client secret to resume a payment after a refresh (never stored). */
  clientSecret(providerPaymentId: string): Promise<string | null>;
  cancelIntent(providerPaymentId: string): Promise<void>;
  refund(
    input: RefundInput,
  ): Promise<{ providerRefundId: string; status: "PENDING" | "SUCCEEDED" | "FAILED" }>;
}
