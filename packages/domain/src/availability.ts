/**
 * Effective availability of a product: the "Esaurito" flag can carry an automatic comeback time
 * ("Disponibile nuovamente domani"). Cached catalogs ship both values; every client and the
 * server evaluate them against the current time.
 */
export function isAvailableNow(
  product: {
    isAvailable: boolean;
    availableAgainAt?: string | Date | null;
    unavailableUntil?: string | Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (product.isAvailable) return true;
  const until = product.availableAgainAt ?? product.unavailableUntil ?? null;
  if (!until) return false;
  return new Date(until).getTime() <= now.getTime();
}
