import { describe, expect, it } from "vitest";
import catalog from "../../db/data/brenvo/catalog.json" with { type: "json" };
import {
  addLine,
  editDistance,
  mergeCarts,
  searchCatalog,
  setLineQuantity,
  validateModifierSelection,
  unitPrice,
  type PricedProduct,
  type SearchDocument,
} from "../src";

const docs: SearchDocument[] = catalog.products.map((p) => ({
  id: p.slug,
  name: p.name,
  nameZh: p.nameZh,
  description: p.description,
  ingredients: p.ingredients,
  categoryName: catalog.categories.find((c) => c.sourceId === p.categorySourceId)!.name,
  posCode: p.posCode,
}));

describe("menu search on the real catalog", () => {
  it("tolerates typos", () => {
    expect(editDistance("raviolli", "ravioli")).toBe(1);
    const hits = searchCatalog(docs, "raviolli gamberi");
    expect(hits[0]?.id).toMatch(/ravioli.*gamberi/);
  });

  it("finds products by ingredient", () => {
    const hits = searchCatalog(docs, "pak choi");
    expect(hits.length).toBeGreaterThanOrEqual(8);
    expect(hits.every((h) => h.id.startsWith("noodles"))).toBe(true);
  });

  it("finds products by category and narrows with every word", () => {
    const all = searchCatalog(docs, "birra").length;
    const asahi = searchCatalog(docs, "birra asahi");
    expect(all).toBeGreaterThanOrEqual(7);
    expect(asahi[0]?.id).toBe("birra-asahi-33-cl");
  });

  it("matches Chinese names and product codes", () => {
    expect(searchCatalog(docs, "饺").length).toBeGreaterThan(10);
    expect(searchCatalog(docs, "d03")[0]?.id).toBe("mochi-gelato-fragola");
  });

  it("ignores accents and empty queries", () => {
    expect(searchCatalog(docs, "   ")).toEqual([]);
    expect(searchCatalog(docs, "SOUFFLÉ").length).toBeGreaterThan(0);
  });
});

describe("cart composition", () => {
  const line = (lineId: string, productId: string, quantity = 1, notes: string | null = null) => ({
    lineId,
    productId,
    variantId: null,
    quantity,
    modifiers: [],
    notes,
  });

  it("merges identical lines and keeps different notes apart", () => {
    let lines = addLine([], line("a", "bao"));
    lines = addLine(lines, line("b", "bao", 2));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(3);
    lines = addLine(lines, line("c", "bao", 1, "senza cipolla"));
    expect(lines).toHaveLength(2);
    expect(setLineQuantity(lines, "c", 0)).toHaveLength(1);
  });

  it("keeps the device cart after login and adds account-only lines", () => {
    const merged = mergeCarts([line("d1", "bao", 2)], [line("s1", "bao", 5), line("s2", "edamame", 1)]);
    expect(merged.find((l) => l.productId === "bao")?.quantity).toBe(2);
    expect(merged.find((l) => l.productId === "edamame")).toBeTruthy();
  });
});

describe("modifier validation (real add-ons for broth noodles)", () => {
  const group = catalog.modifierGroups[0]!;
  const product: PricedProduct = {
    id: "noodles",
    name: "Noodles freschi con manzo in brodo",
    categoryId: "broth",
    priceCents: 890,
    vatRateBps: 1000,
    isAvailable: true,
    excludedFromDiscounts: false,
    maxQuantityPerLine: 30,
    variants: [],
    modifierGroups: [
      {
        id: "g",
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        maxTotalQuantity: group.maxTotalQuantity,
        options: group.options.map((o) => ({
          id: o.sourceId,
          groupId: "g",
          name: o.name,
          priceDeltaCents: o.priceDeltaCents,
          isAvailable: true,
          maxQuantity: group.optionMaxQuantity,
        })),
      },
    ],
  };
  const [ribs, beef, pakChoi] = group.options.map((o) => o.sourceId) as [string, string, string];

  it("prices optional extras", () => {
    const r = validateModifierSelection(product, [
      { modifierId: beef, quantity: 1 },
      { modifierId: pakChoi, quantity: 2 },
    ]);
    expect(r.ok).toBe(true);
    expect(unitPrice(product, r.resolved)).toBe(890 + 300 + 200);
  });

  it("enforces per-option and per-group limits", () => {
    const tooMany = validateModifierSelection(product, [{ modifierId: ribs, quantity: 3 }]);
    expect(tooMany).toMatchObject({ ok: false });
    const unknown = validateModifierSelection(product, [{ modifierId: "nope", quantity: 1 }]);
    expect(unknown.ok).toBe(false);
  });

  it("enforces required groups", () => {
    const required: PricedProduct = {
      ...product,
      modifierGroups: [{ ...product.modifierGroups[0]!, minSelect: 1, maxSelect: 1 }],
    };
    expect(validateModifierSelection(required, [])).toMatchObject({
      ok: false,
      errors: [{ code: "TOO_FEW_OPTIONS" }],
    });
    expect(
      validateModifierSelection(required, [
        { modifierId: ribs, quantity: 1 },
        { modifierId: beef, quantity: 1 },
      ]),
    ).toMatchObject({ ok: false, errors: [{ code: "TOO_MANY_OPTIONS" }] });
  });
});
