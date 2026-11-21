import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/seed/import-catalog";

describe("restaurant paper menu", () => {
  it("applies all 66 approved dishes without duplicates and retains existing images", () => {
    const catalog = loadCatalog();
    const reviewed = catalog.products.filter((p) => p.menuRevision === "2026-11-21");
    expect(reviewed).toHaveLength(66);
    expect(new Set(catalog.products.map((p) => p.sourceId)).size).toBe(catalog.products.length);
    expect(reviewed.find((p) => p.sourceId.endsWith("707c"))).toMatchObject({ priceCents: 590 });
    expect(reviewed.find((p) => p.slug === "focaccia-vegetariana")).toMatchObject({
      priceCents: 500,
      allergensDeclared: false,
    });
    expect(reviewed.find((p) => p.sourceId.endsWith("7038"))?.image).not.toBeNull();
    expect(catalog.products.find((p) => p.sourceId.endsWith("7039"))?.name).toContain("cipollotto");
    expect(loadCatalog()).toEqual(catalog);
  });
});
