import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { deviceHeaders, DISHES, expect, ORIGIN, signInApi, staff, test } from "../helpers";

interface Product {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  image: { url: string } | null;
  variants: unknown[];
  modifierGroups: { minSelect: number }[];
}

const json = { "Content-Type": "application/json", Origin: ORIGIN };

async function catalog(request: APIRequestContext): Promise<Record<string, Product>> {
  const res = await request.get("/api/v1/catalog");
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { products: Record<string, Product> }).products;
}

function line(p: Product, quantity: number) {
  return {
    lineId: crypto.randomUUID(),
    productId: p.id,
    variantId: null,
    quantity,
    modifiers: [],
    notes: null,
    expectedUnitPriceCents: p.priceCents,
  };
}

async function pickupOrder(
  request: APIRequestContext,
  email: string,
  mutate?: (body: Record<string, unknown>) => void,
) {
  const products = Object.values(await catalog(request));
  const ravioli = products.find((p) => p.name === DISHES.ravioli)!;
  const lines = [line(ravioli, 9)];
  const quote = await request.post("/api/v1/cart/quote", {
    data: {
      lines,
      fulfillmentType: "PICKUP",
      delivery: null,
      couponCode: null,
      tipCents: 0,
      scheduledFor: null,
    },
    headers: json,
  });
  const q = (await quote.json()) as { totals: { totalCents: number; discountCents: number } };
  const idempotencyKey = crypto.randomUUID();
  const body: Record<string, unknown> = {
    idempotencyKey,
    lines,
    fulfillmentType: "PICKUP",
    scheduledFor: null,
    address: null,
    customer: { name: "Test E2E", email, phone: "+393331234567" },
    couponCode: null,
    tipCents: 0,
    paymentMethod: "ONLINE",
    kitchenNotes: null,
    ageConfirmed: false,
    marketingConsent: false,
    saveAddress: false,
    expectedTotalCents: q.totals.totalCents,
    expectedDiscountCents: q.totals.discountCents,
    source: "web",
  };
  mutate?.(body);
  const res = await request.post("/api/v1/checkout/orders", {
    data: body,
    headers: { ...json, "Idempotency-Key": idempotencyKey },
  });
  return { res, body, idempotencyKey, quote: q };
}

test.describe("API v1", () => {
  test("il catalogo è quello reale, con foto reali", async ({ request }) => {
    const products = Object.values(await catalog(request));
    expect(products.length).toBeGreaterThanOrEqual(100);
    expect(products.map((p) => p.name)).toContain(DISHES.ravioli);
    expect(products.filter((p) => /lorem|demo|prodotto di prova/i.test(p.name))).toHaveLength(0);
    for (const p of products.filter((x) => x.image)) expect(p.image!.url).toMatch(/^\/menu\/.+\.webp$/);
  });

  test("il preventivo applica da solo la promozione sopra i 30 €", async ({ request }) => {
    const products = Object.values(await catalog(request));
    const ravioli = products.find((p) => p.name === DISHES.ravioli)!;
    const res = await request.post("/api/v1/cart/quote", {
      data: {
        lines: [line(ravioli, 9)],
        fulfillmentType: "PICKUP",
        delivery: null,
        couponCode: null,
        tipCents: 0,
        scheduledFor: null,
      },
      headers: json,
    });
    const quote = (await res.json()) as {
      totals: { subtotalCents: number; discountCents: number };
      coupon: { automatic: boolean } | null;
    };
    expect(quote.totals.subtotalCents).toBe(ravioli.priceCents * 9);
    expect(quote.totals.discountCents).toBeGreaterThan(0);
    expect(quote.coupon?.automatic).toBe(true);
  });

  test("il server rifiuta un totale diverso da quello calcolato", async ({ request }) => {
    const { res } = await pickupOrder(request, `prezzo-${Date.now()}@example.com`, (b) => {
      b.expectedTotalCents = 1;
      b.expectedDiscountCents = undefined;
    });
    expect(res.status()).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("PRICE_CHANGED");
  });

  test("checkout idempotente, pagamento confermato solo dal server, tracking riservato", async ({
    request,
  }) => {
    const email = `ospite-${Date.now()}@example.com`;
    const { res, body, idempotencyKey } = await pickupOrder(request, email);
    expect(res.ok()).toBeTruthy();
    const order = (await res.json()) as { publicId: string; number: string; status: string };
    expect(order.status).toBe("PENDING_PAYMENT");

    // A double tap or a retry never creates a second order.
    const again = await request.post("/api/v1/checkout/orders", {
      data: body,
      headers: { ...json, "Idempotency-Key": idempotencyKey },
    });
    expect(((await again.json()) as { publicId: string }).publicId).toBe(order.publicId);

    // Unpaid orders never reach the kitchen.
    const tracking = (await (await request.get(`/api/v1/orders/${order.publicId}`)).json()) as {
      status: string;
      customer: { email: string };
    };
    expect(tracking.status).toBe("PENDING_PAYMENT");
    expect(tracking.customer.email).not.toBe(email);
    expect(tracking.customer.email).toContain("***");

    expect(
      (
        await request.post(`/api/v1/dev/payments/${order.publicId}`, {
          data: { outcome: "succeed" },
          headers: json,
        })
      ).ok(),
    ).toBeTruthy();
    await expect
      .poll(
        async () =>
          ((await (await request.get(`/api/v1/orders/${order.publicId}`)).json()) as { status: string })
            .status,
      )
      .toBe("RECEIVED");

    // No rider position is ever exposed before pickup.
    const location = (await (
      await request.get(`/api/v1/orders/${order.publicId}/rider-location`)
    ).json()) as { location: unknown };
    expect(location.location).toBeNull();
    expect((await request.get(`/api/v1/orders/abcdefghijklmnopqrstuvwx`)).status()).toBe(404);
  });

  test("il cliente può annullare prima che la cucina accetti e viene rimborsato", async ({ request }) => {
    const { res } = await pickupOrder(request, `annullo-${Date.now()}@example.com`);
    const order = (await res.json()) as { publicId: string };
    await request.post(`/api/v1/dev/payments/${order.publicId}`, {
      data: { outcome: "succeed" },
      headers: json,
    });
    await expect
      .poll(
        async () =>
          ((await (await request.get(`/api/v1/orders/${order.publicId}`)).json()) as { status: string })
            .status,
      )
      .toBe("RECEIVED");
    const cancel = await request.post(`/api/v1/orders/${order.publicId}/cancel`, {
      data: { reason: "Ho sbagliato indirizzo" },
      headers: json,
    });
    expect(cancel.ok()).toBeTruthy();
    const tracking = (await cancel.json()) as { status: string; canCancel: boolean };
    expect(["CANCELLED", "REFUNDED"]).toContain(tracking.status);
  });

  test("aree riservate: anonimi, clienti e staff", async ({ request }) => {
    expect((await request.get("/api/v1/admin/kitchen")).status()).toBe(401);
    expect((await request.get("/api/v1/rider/me")).status()).toBe(401);

    const customer = await playwrightRequest.newContext({
      baseURL: ORIGIN,
      extraHTTPHeaders: deviceHeaders(),
    });
    const email = `cliente-${Date.now()}@example.com`;
    const signUp = await customer.post("/api/auth/sign-up/email", {
      data: { name: "Cliente Prova", email, password: "Password-sicura-123" },
      headers: { Origin: ORIGIN },
    });
    expect(signUp.ok()).toBeTruthy();
    expect((await customer.get("/api/v1/me")).ok()).toBeTruthy();
    expect((await customer.get("/api/v1/admin/kitchen")).status()).toBe(403);
    expect((await customer.get("/api/v1/rider/me")).status()).toBe(403);
    // Cookie-authenticated writes from another site are refused (CSRF).
    const csrf = await customer.patch("/api/v1/me", {
      data: { name: "Hacker", phone: null, birthDate: null },
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    });
    expect(csrf.status()).toBe(403);
    await customer.dispose();

    const kitchen = await playwrightRequest.newContext({
      baseURL: ORIGIN,
      extraHTTPHeaders: deviceHeaders(),
    });
    await signInApi(kitchen, staff());
    expect((await kitchen.get("/api/v1/admin/kitchen")).ok()).toBeTruthy();
    // Staff cannot change prices or refund: those are admin permissions.
    expect((await kitchen.get("/api/v1/admin/settings")).status()).toBe(403);
    await kitchen.dispose();
  });

  test("webhook Stripe e cron non accettano chiamate non firmate", async ({ request }) => {
    const webhook = await request.post("/api/webhooks/stripe", {
      data: { type: "payment_intent.succeeded" },
      headers: { "Content-Type": "application/json" },
    });
    expect(webhook.ok()).toBeFalsy();
    expect((await request.get("/api/cron/operations")).status()).toBe(401);
    expect(
      (await request.get("/api/cron/daily", { headers: { Authorization: "Bearer sbagliato" } })).status(),
    ).toBe(401);
  });
});
