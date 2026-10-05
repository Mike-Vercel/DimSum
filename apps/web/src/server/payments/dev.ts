import "server-only";
import { features } from "../env";
import type { PaymentGateway } from "./types";

function assertAllowed() {
  if (features().paymentProvider !== "dev")
    throw new Error("The payment simulator is disabled in this environment");
}

/**
 * Local payment simulator: lets the full order flow run without Stripe keys. The customer
 * confirms on a clearly labelled test screen and the server runs the same handlers as the
 * Stripe webhook. Never available on the production deployment (see env.features()).
 */
export const devGateway: PaymentGateway = {
  name: "DEV",

  async createIntent(input) {
    assertAllowed();
    return {
      providerPaymentId: `dev_pi_${input.idempotencyKey}`,
      clientSecret: `dev_secret_${input.publicId}`,
    };
  },

  async clientSecret(providerPaymentId) {
    assertAllowed();
    return providerPaymentId.replace("dev_pi_", "dev_secret_");
  },

  async cancelIntent() {
    assertAllowed();
  },

  async refund(input) {
    assertAllowed();
    return { providerRefundId: `dev_re_${input.idempotencyKey}`, status: "SUCCEEDED" };
  },
};
