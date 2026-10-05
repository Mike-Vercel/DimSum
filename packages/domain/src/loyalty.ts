/**
 * Dimsum Club rules. Points are earned on delivered orders (never on payment, so refunds and
 * cancellations need no clawback in most cases) and reversed on refunds.
 */
import type { Cents } from "./money";

export interface LoyaltyTier {
  key: string;
  name: string;
  /** Lifetime points needed to reach the tier. */
  minLifetimePoints: number;
  /** Earn multiplier in basis points (10000 = ×1). */
  multiplierBps: number;
}

export interface LoyaltyConfig {
  enabled: boolean;
  programName: string;
  /** Points per whole euro spent on items after discounts (tips and delivery excluded). */
  pointsPerEuro: number;
  tiers: LoyaltyTier[];
  /** Points expire after N months of inactivity; null = never. */
  expiryMonths: number | null;
  birthdayBonusPoints: number;
  signupBonusPoints: number;
}

export function pointsForOrder(
  config: LoyaltyConfig,
  eligibleAmountCents: Cents,
  lifetimePoints: number,
): number {
  if (!config.enabled || eligibleAmountCents <= 0) return 0;
  const tier = tierFor(config, lifetimePoints);
  const base = Math.floor(eligibleAmountCents / 100) * config.pointsPerEuro;
  return Math.floor((base * (tier?.multiplierBps ?? 10_000)) / 10_000);
}

export function tierFor(config: LoyaltyConfig, lifetimePoints: number): LoyaltyTier | null {
  const sorted = [...config.tiers].sort((a, b) => b.minLifetimePoints - a.minLifetimePoints);
  return sorted.find((t) => lifetimePoints >= t.minLifetimePoints) ?? null;
}

export function nextTier(
  config: LoyaltyConfig,
  lifetimePoints: number,
): { tier: LoyaltyTier; pointsNeeded: number } | null {
  const next = [...config.tiers]
    .sort((a, b) => a.minLifetimePoints - b.minLifetimePoints)
    .find((t) => t.minLifetimePoints > lifetimePoints);
  return next ? { tier: next, pointsNeeded: next.minLifetimePoints - lifetimePoints } : null;
}

/** Points to take back when part of an order is refunded, proportional to the refunded amount. */
export function pointsToReverse(
  earnedPoints: number,
  orderEligibleCents: Cents,
  refundedCents: Cents,
): number {
  if (earnedPoints <= 0 || orderEligibleCents <= 0) return 0;
  const ratio = Math.min(1, refundedCents / orderEligibleCents);
  return Math.round(earnedPoints * ratio);
}
