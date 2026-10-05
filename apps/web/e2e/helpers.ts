import { randomInt } from "node:crypto";
import { test as base, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

export { expect };

/**
 * Every simulated device gets its own client IP, as real phones and tablets do: rate limits
 * (sign-in included) are per IP, and without this the whole suite would share 127.0.0.1. The app
 * reads the IP from x-forwarded-for, which Vercel sets on every request in production.
 */
export function deviceHeaders(): Record<string, string> {
  return { "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}` };
}

/** Playwright test whose default page and request fixtures are one more device. */
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    await use({ ...extraHTTPHeaders, ...deviceHeaders() });
  },
});

/** Same origin as the app: Better Auth and the API refuse cross-site writes. */
export const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 3100}`;

export interface Account {
  email: string;
  password: string;
}

function account(prefix: string): Account {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password)
    throw new Error(
      `${prefix}_EMAIL / ${prefix}_PASSWORD missing: the suite uses the bootstrap accounts of the seed.`,
    );
  return { email, password };
}

export const staff = () => account("SEED_STAFF");
export const admin = () => account("SEED_ADMIN");
export const rider = () => account("SEED_RIDER");

/** Real dishes of the imported catalog (no demo products exist). */
export const DISHES = {
  ravioli: "Ravioli al vapore di gamberi",
  noodles: "Noodles freschi con manzo in brodo",
} as const;

/** An address inside the first delivery band (Via Ruggero Settimo, Palermo). */
export const DELIVERY_ADDRESS = {
  street: "Via Ruggero Settimo",
  streetNumber: "20",
  postalCode: "90139",
  city: "Palermo",
  province: "PA",
  country: "IT",
  formatted: "Via Ruggero Settimo 20, 90139 Palermo",
  location: { lat: 38.1229, lng: 13.3597 },
  placeId: null,
  precision: "rooftop" as const,
  staircase: "B",
  floor: "3",
  apartment: null,
  intercom: "Test",
  riderNotes: "Portone verde",
};

export async function signInApi(request: APIRequestContext, who: Account): Promise<void> {
  const res = await request.post("/api/auth/sign-in/email", { data: who, headers: { Origin: ORIGIN } });
  expect(res.ok(), `sign-in ${who.email}`).toBeTruthy();
}

export async function signInUi(
  page: Page,
  who: Account,
  path: "/login" | "/rider/login" = "/login",
  next?: string,
): Promise<void> {
  await page.goto(`${path}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("E-mail", { exact: true }).fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

/** A separate signed-in browser (kitchen tablet, rider phone). */
export async function openAs(
  browser: Browser,
  who: Account,
  opts: { mobile?: boolean; path?: "/login" | "/rider/login"; next: string },
): Promise<Page> {
  const device = opts.mobile
    ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } };
  const context = await browser.newContext({ ...device, locale: "it-IT", extraHTTPHeaders: deviceHeaders() });
  const page = await context.newPage();
  await signInUi(page, who, opts.path ?? "/login", opts.next);
  await page.waitForURL((url) => url.pathname.startsWith(opts.next));
  return page;
}

/** Adds a dish from the menu with its quick "+" button. */
export async function addFromMenu(page: Page, dish: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page
      .getByRole("button", { name: `Aggiungi ${dish} al carrello` })
      .first()
      .click();
  }
}

/** Puts a confirmed delivery address on the device, as the address picker would. */
export async function rememberDeliveryAddress(page: Page): Promise<void> {
  await page.addInitScript((address) => {
    // Only while no address is remembered (a sign-out forgets it): choices made in the UI win.
    try {
      if (JSON.parse(localStorage.getItem("dimsum.order-prefs") ?? "null")?.state?.address) return;
    } catch {
      /* unreadable: replace it */
    }
    localStorage.setItem(
      "dimsum.order-prefs",
      JSON.stringify({
        state: {
          fulfillment: "DELIVERY",
          address: { ...address, savedAddressId: null },
          deliveryQuote: null,
          schedule: { mode: "asap", slotStart: null, slotLabel: null },
        },
        version: 1,
      }),
    );
  }, DELIVERY_ADDRESS);
}

export function orderNumberFrom(text: string): string {
  const match = text.match(/#?([A-Z]{1,4}\d{4,})/);
  if (!match?.[1]) throw new Error(`order number not found in "${text}"`);
  return match[1];
}
