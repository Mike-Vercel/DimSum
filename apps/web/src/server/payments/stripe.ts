import "server-only";
import Stripe from "stripe";
import { env } from "../env";
import type { PaymentGateway } from "./types";

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  if (!client) {
    const key = env().STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    client = new Stripe(key, {
      maxNetworkRetries: 2,
      timeout: 15_000,
      appInfo: { name: "DIMSUM Ordering", version: "1.0.0" },
    });
  }
  return client;
}

/** Stripe PaymentIntents: card, Apple Pay and Google Pay through automatic payment methods. */
export const stripeGateway: PaymentGateway = {
  name: "STRIPE",

  async createIntent(input) {
    const intent = await stripeClient().paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency,
        automatic_payment_methods: { enabled: true },
        description: input.description,
        receipt_email: input.email,
        statement_descriptor_suffix: "DIMSUM",
        metadata: { orderId: input.orderId, publicId: input.publicId, orderNumber: input.orderNumber },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return { providerPaymentId: intent.id, clientSecret: intent.client_secret };
  },

  async clientSecret(providerPaymentId) {
    const intent = await stripeClient().paymentIntents.retrieve(providerPaymentId);
    return intent.client_secret;
  },

  async cancelIntent(providerPaymentId) {
    const intent = await stripeClient().paymentIntents.retrieve(providerPaymentId);
    if (
      ["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(
        intent.status,
      )
    ) {
      await stripeClient().paymentIntents.cancel(providerPaymentId, { cancellation_reason: "abandoned" });
    }
  },

  async refund(input) {
    const refund = await stripeClient().refunds.create(
      {
        payment_intent: input.providerPaymentId,
        amount: input.amountCents,
        metadata: { reason: input.reason.slice(0, 450) },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    const status =
      refund.status === "succeeded"
        ? "SUCCEEDED"
        : refund.status === "failed" || refund.status === "canceled"
          ? "FAILED"
          : "PENDING";
    return { providerRefundId: refund.id, status };
  },
};
