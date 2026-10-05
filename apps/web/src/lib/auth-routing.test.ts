import { describe, expect, it } from "vitest";
import { authErrorMessage, homeForRole, safeNext } from "./auth-routing";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/checkout?riprendi=1")).toBe("/checkout?riprendi=1");
    expect(safeNext("/account/ordini")).toBe("/account/ordini");
  });

  it("refuses open redirects and API targets", () => {
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("/api/v1/me")).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("homeForRole", () => {
  it("sends each role to its own area", () => {
    expect(homeForRole("CUSTOMER")).toBe("/account");
    expect(homeForRole("RIDER")).toBe("/rider");
    expect(homeForRole("STAFF")).toBe("/admin");
    expect(homeForRole("SUPER_ADMIN")).toBe("/admin");
    expect(homeForRole(undefined)).toBe("/account");
  });
});

describe("authErrorMessage", () => {
  it("translates known errors without leaking technical text", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe(
      "E-mail o password non corretti.",
    );
    expect(authErrorMessage({ status: 429 })).toMatch(/Troppi tentativi/);
    expect(
      authErrorMessage({ code: "SOMETHING_INTERNAL", status: 500, message: "stack trace…" }),
    ).not.toMatch(/stack/);
  });

  it("shows the server message for disabled accounts", () => {
    expect(authErrorMessage({ status: 403, message: "Questo account è disattivato." })).toBe(
      "Questo account è disattivato.",
    );
  });
});
