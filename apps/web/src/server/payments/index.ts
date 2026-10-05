import "server-only";
import { AppError } from "../errors";
import { features } from "../env";
import { devGateway } from "./dev";
import { stripeGateway } from "./stripe";
import type { PaymentGateway } from "./types";

export function onlineGateway(): PaymentGateway {
  const provider = features().paymentProvider;
  if (provider === "stripe") return stripeGateway;
  if (provider === "dev") return devGateway;
  throw new AppError(
    "PAYMENT_UNAVAILABLE",
    "I pagamenti online non sono disponibili in questo momento. Scegli il pagamento alla consegna o riprova più tardi.",
  );
}

export function gatewayFor(provider: "STRIPE" | "DEV" | "CASH"): PaymentGateway | null {
  if (provider === "STRIPE") return stripeGateway;
  if (provider === "DEV") return features().paymentProvider === "dev" ? devGateway : null;
  return null;
}

export type { PaymentGateway } from "./types";
