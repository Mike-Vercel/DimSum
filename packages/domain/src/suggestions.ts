/**
 * "Ti potrebbe piacere": discreet, rule-based cross-selling. No profiling — only the current cart
 * and the menu structure are used.
 */

export interface SuggestionProduct {
  id: string;
  categoryId: string;
  isAvailable: boolean;
  priceCents: number;
  isFeatured: boolean;
  salesRank: number | null;
}

export interface SuggestionRules {
  /** Category ids treated as complements (drinks, desserts, sides) in priority order. */
  complementCategoryIds: string[];
  limit: number;
}

export function suggestProducts(
  products: readonly SuggestionProduct[],
  cartProductIds: readonly string[],
  rules: SuggestionRules,
): string[] {
  if (cartProductIds.length === 0) return [];
  const inCart = new Set(cartProductIds);
  const cartCategories = new Set(products.filter((p) => inCart.has(p.id)).map((p) => p.categoryId));
  const rank = (p: SuggestionProduct) => (p.salesRank ?? 999) - (p.isFeatured ? 500 : 0);

  const picks: string[] = [];
  // One product per complementary category the cart does not contain yet.
  for (const categoryId of rules.complementCategoryIds) {
    if (picks.length >= rules.limit) break;
    if (cartCategories.has(categoryId)) continue;
    const best = products
      .filter((p) => p.categoryId === categoryId && p.isAvailable && !inCart.has(p.id))
      .sort((a, b) => rank(a) - rank(b) || a.priceCents - b.priceCents)[0];
    if (best) picks.push(best.id);
  }
  // Then popular products not in the cart.
  if (picks.length < rules.limit) {
    const popular = products
      .filter(
        (p) =>
          p.isAvailable &&
          !inCart.has(p.id) &&
          !picks.includes(p.id) &&
          (p.salesRank !== null || p.isFeatured),
      )
      .sort((a, b) => rank(a) - rank(b));
    for (const p of popular) {
      if (picks.length >= rules.limit) break;
      picks.push(p.id);
    }
  }
  return picks;
}
