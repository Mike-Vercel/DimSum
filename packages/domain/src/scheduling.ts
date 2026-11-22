/**
 * Scheduled orders reach the kitchen only shortly before they are needed, as on the delivery
 * platforms: they can be accepted (and the alert rings) from 30 minutes before the food must be
 * ready, i.e. before the chosen time minus the ride for deliveries. ASAP orders are acceptable at once.
 */
export const SCHEDULED_ACCEPT_WINDOW_MINUTES = 30;

/** Default ride when the route is unknown, in seconds (matches the kitchen board's due time). */
const DEFAULT_RIDE_SECONDS = 600;

export function scheduledReadyAt(o: {
  isScheduled: boolean;
  scheduledFor: Date | null;
  fulfillmentType: "DELIVERY" | "PICKUP";
  routeDurationSeconds: number | null;
}): Date | null {
  if (!o.isScheduled || !o.scheduledFor) return null;
  const ride = o.fulfillmentType === "DELIVERY" ? (o.routeDurationSeconds ?? DEFAULT_RIDE_SECONDS) * 1000 : 0;
  return new Date(o.scheduledFor.getTime() - ride);
}

/** From when the order can be accepted; null = right away (ASAP orders). */
export function acceptableFrom(
  o: Parameters<typeof scheduledReadyAt>[0],
  windowMinutes = SCHEDULED_ACCEPT_WINDOW_MINUTES,
): Date | null {
  const ready = scheduledReadyAt(o);
  return ready ? new Date(ready.getTime() - windowMinutes * 60_000) : null;
}

export function isAcceptableNow(o: Parameters<typeof scheduledReadyAt>[0], now: Date): boolean {
  const from = acceptableFrom(o);
  return !from || from.getTime() <= now.getTime();
}
