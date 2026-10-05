import { describe, expect, it } from "vitest";
import { centsToInput, firstErrors, parseEuroToCents } from "./forms";

describe("parseEuroToCents", () => {
  it("accepts the Italian and the dotted notation", () => {
    expect(parseEuroToCents("8,90")).toBe(890);
    expect(parseEuroToCents("8.9")).toBe(890);
    expect(parseEuroToCents(" 12 ")).toBe(1200);
    expect(parseEuroToCents("€ 3,50")).toBe(350);
    expect(parseEuroToCents("0")).toBe(0);
  });

  it("never rounds a typo into a different price", () => {
    expect(parseEuroToCents("8,999")).toBeNull();
    expect(parseEuroToCents("-2")).toBeNull();
    expect(parseEuroToCents("otto")).toBeNull();
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("1,2,3")).toBeNull();
  });

  it("avoids floating point drift on common prices", () => {
    expect(parseEuroToCents("0,29")).toBe(29);
    expect(parseEuroToCents("19,99")).toBe(1999);
  });
});

describe("centsToInput", () => {
  it("formats cents for editable inputs", () => {
    expect(centsToInput(890)).toBe("8,90");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(null)).toBe("");
  });
});

describe("firstErrors", () => {
  it("keeps the first message of each field", () => {
    expect(firstErrors({ name: ["Troppo corto", "Altro"], price: [] })).toEqual({
      name: "Troppo corto",
      price: "",
    });
    expect(firstErrors(undefined)).toEqual({});
  });
});
