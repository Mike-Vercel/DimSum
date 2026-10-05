/**
 * Catalog model used by pricing and validation. Mirrors the persisted catalog but carries only
 * what the business rules need, so the same logic runs on the server and in native clients.
 */
import type { Cents } from "./money";

export interface PricedModifier {
  id: string;
  groupId: string;
  name: string;
  priceDeltaCents: Cents;
  isAvailable: boolean;
  /** Maximum quantity of this single option inside one line (usually 1). */
  maxQuantity: number;
}

export interface PricedModifierGroup {
  id: string;
  name: string;
  /** Minimum number of distinct options to pick. 0 = optional group. */
  minSelect: number;
  /** Maximum number of distinct options to pick. */
  maxSelect: number;
  /** Maximum sum of option quantities. */
  maxTotalQuantity: number;
  options: PricedModifier[];
}

export interface PricedVariant {
  id: string;
  name: string;
  /** Absolute price of the variant (replaces the product base price). */
  priceCents: Cents;
  isAvailable: boolean;
}

export interface PricedProduct {
  id: string;
  name: string;
  categoryId: string;
  priceCents: Cents;
  /** When present, the customer must pick exactly one variant (e.g. size). */
  variants: PricedVariant[];
  vatRateBps: number;
  isAvailable: boolean;
  excludedFromDiscounts: boolean;
  modifierGroups: PricedModifierGroup[];
  /** Hard cap per line, protects the kitchen from accidental 99× quantities. */
  maxQuantityPerLine: number;
}

export interface ModifierSelection {
  modifierId: string;
  quantity: number;
}

export interface ResolvedModifier {
  modifier: PricedModifier;
  group: PricedModifierGroup;
  quantity: number;
}

export type ModifierError =
  | { code: "UNKNOWN_MODIFIER"; modifierId: string }
  | { code: "MODIFIER_UNAVAILABLE"; modifierId: string; name: string }
  | { code: "QUANTITY_OUT_OF_RANGE"; modifierId: string; name: string; max: number }
  | { code: "TOO_FEW_OPTIONS"; groupId: string; groupName: string; min: number }
  | { code: "TOO_MANY_OPTIONS"; groupId: string; groupName: string; max: number }
  | { code: "TOO_MANY_UNITS"; groupId: string; groupName: string; max: number };

export function validateModifierSelection(
  product: PricedProduct,
  selections: readonly ModifierSelection[],
):
  | { ok: true; resolved: ResolvedModifier[] }
  | { ok: false; errors: ModifierError[]; resolved: ResolvedModifier[] } {
  const errors: ModifierError[] = [];
  const index = new Map<string, { modifier: PricedModifier; group: PricedModifierGroup }>();
  for (const group of product.modifierGroups) {
    for (const option of group.options) index.set(option.id, { modifier: option, group });
  }

  // Merge duplicates (same option sent twice) before validating quantities.
  const merged = new Map<string, number>();
  for (const s of selections) merged.set(s.modifierId, (merged.get(s.modifierId) ?? 0) + s.quantity);

  const resolved: ResolvedModifier[] = [];
  for (const [modifierId, quantity] of merged) {
    const hit = index.get(modifierId);
    if (!hit) {
      errors.push({ code: "UNKNOWN_MODIFIER", modifierId });
      continue;
    }
    if (!hit.modifier.isAvailable) {
      errors.push({ code: "MODIFIER_UNAVAILABLE", modifierId, name: hit.modifier.name });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > hit.modifier.maxQuantity) {
      errors.push({
        code: "QUANTITY_OUT_OF_RANGE",
        modifierId,
        name: hit.modifier.name,
        max: hit.modifier.maxQuantity,
      });
      continue;
    }
    resolved.push({ modifier: hit.modifier, group: hit.group, quantity });
  }

  for (const group of product.modifierGroups) {
    const picked = resolved.filter((r) => r.group.id === group.id);
    const distinct = picked.length;
    const units = picked.reduce((a, r) => a + r.quantity, 0);
    if (distinct < group.minSelect) {
      errors.push({
        code: "TOO_FEW_OPTIONS",
        groupId: group.id,
        groupName: group.name,
        min: group.minSelect,
      });
    }
    if (distinct > group.maxSelect) {
      errors.push({
        code: "TOO_MANY_OPTIONS",
        groupId: group.id,
        groupName: group.name,
        max: group.maxSelect,
      });
    }
    if (units > group.maxTotalQuantity) {
      errors.push({
        code: "TOO_MANY_UNITS",
        groupId: group.id,
        groupName: group.name,
        max: group.maxTotalQuantity,
      });
    }
  }

  // Stable output order: by group order, then option order, so line signatures are deterministic.
  const groupOrder = new Map(product.modifierGroups.map((g, i) => [g.id, i]));
  const optionOrder = new Map(
    product.modifierGroups.flatMap((g) => g.options.map((o, i) => [o.id, i] as const)),
  );
  resolved.sort(
    (a, b) =>
      (groupOrder.get(a.group.id) ?? 0) - (groupOrder.get(b.group.id) ?? 0) ||
      (optionOrder.get(a.modifier.id) ?? 0) - (optionOrder.get(b.modifier.id) ?? 0),
  );

  return errors.length ? { ok: false, errors, resolved } : { ok: true, resolved };
}

export function describeModifierError(error: ModifierError): string {
  switch (error.code) {
    case "UNKNOWN_MODIFIER":
      return "Una delle opzioni scelte non è più disponibile.";
    case "MODIFIER_UNAVAILABLE":
      return `"${error.name}" al momento non è disponibile.`;
    case "QUANTITY_OUT_OF_RANGE":
      return `Puoi aggiungere al massimo ${error.max} × "${error.name}".`;
    case "TOO_FEW_OPTIONS":
      return error.min === 1
        ? `Scegli un'opzione per "${error.groupName}".`
        : `Scegli almeno ${error.min} opzioni per "${error.groupName}".`;
    case "TOO_MANY_OPTIONS":
      return `Puoi scegliere al massimo ${error.max} opzioni per "${error.groupName}".`;
    case "TOO_MANY_UNITS":
      return `Puoi aggiungere al massimo ${error.max} extra per "${error.groupName}".`;
  }
}

export type VariantError =
  "VARIANT_REQUIRED" | "UNKNOWN_VARIANT" | "VARIANT_UNAVAILABLE" | "VARIANT_NOT_ALLOWED";

export function resolveVariant(
  product: Pick<PricedProduct, "variants">,
  variantId: string | null,
): { ok: true; variant: PricedVariant | null } | { ok: false; error: VariantError } {
  if (product.variants.length === 0) {
    return variantId ? { ok: false, error: "VARIANT_NOT_ALLOWED" } : { ok: true, variant: null };
  }
  if (!variantId) return { ok: false, error: "VARIANT_REQUIRED" };
  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) return { ok: false, error: "UNKNOWN_VARIANT" };
  if (!variant.isAvailable) return { ok: false, error: "VARIANT_UNAVAILABLE" };
  return { ok: true, variant };
}

export function unitPrice(
  product: Pick<PricedProduct, "priceCents">,
  resolved: readonly ResolvedModifier[],
  variant: Pick<PricedVariant, "priceCents"> | null = null,
): Cents {
  const base = variant ? variant.priceCents : product.priceCents;
  return base + resolved.reduce((sum, r) => sum + r.modifier.priceDeltaCents * r.quantity, 0);
}

/**
 * Identity of a cart line: two lines with the same product, options and notes are merged.
 */
export function lineSignature(
  productId: string,
  modifiers: readonly ModifierSelection[],
  notes: string | null,
  variantId: string | null = null,
): string {
  const mods = [...modifiers]
    .filter((m) => m.quantity > 0)
    .sort((a, b) => a.modifierId.localeCompare(b.modifierId))
    .map((m) => `${m.modifierId}x${m.quantity}`)
    .join(",");
  return `${productId}|${variantId ?? ""}|${mods}|${(notes ?? "").trim().toLowerCase()}`;
}
