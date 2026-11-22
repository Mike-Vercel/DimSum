import { addFromMenu, DISHES, expect, latestOtp, rememberDeliveryAddress, test } from "../helpers";

/**
 * Account journey (the Google button follows the same redirect path, see README):
 * registration → sign out → cart filled as a guest → "Accedi con e-mail" from the checkout →
 * back to the checkout with the cart intact → order with a saved address → order history.
 */
test("login dal checkout: carrello conservato, indirizzo salvato, storico ordini", async ({ page }) => {
  const email = `cliente.${Date.now()}@example.com`;
  const password = "Ravioli-al-vapore-2026";

  // Sign-up with the e-mail code: e-mail → 6-digit code → name, surname, password → address (skipped).
  await page.goto("/registrati");
  await page.getByRole("button", { name: /Continua con e-mail/ }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Inviami il codice" }).click();
  await expect(page.getByText("Controlla l'e-mail")).toBeVisible();
  await page.getByLabel("Codice").fill(await latestOtp(email));
  await expect(page.getByText("Come ti chiami?")).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill("Sara");
  await page.getByLabel("Cognome").fill("Cliente");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(page.getByText("Dove ti portiamo il cibo?")).toBeVisible();
  await page.getByRole("button", { name: "Salta per ora" }).click();
  await page.waitForURL("**/menu");
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: /Ciao, Sara/ })).toBeVisible();
  await page.getByRole("button", { name: "Esci" }).click();
  await page.waitForURL((u) => u.pathname === "/");

  // Guest cart with a delivery address.
  await rememberDeliveryAddress(page);
  await page.goto("/menu");
  // Above the 20 € minimum of the city-centre zone.
  await addFromMenu(page, DISHES.ravioli, 6);
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page.getByRole("link", { name: /Accedi con e-mail/ }).click();

  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();

  // Back to the checkout, signed in, with cart and address untouched: the new account only lacks a phone.
  await page.waitForURL((u) => u.pathname === "/checkout");
  await expect(page.getByText("Ordini come Sara Cliente")).toBeVisible();
  await page.getByLabel(/Telefono/).fill("+39 333 222 3333");
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Il tuo ordine" }).getByText(`6× ${DISHES.ravioli}`),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Contanti alla consegna/ }).click();
  await page.getByRole("button", { name: /Conferma ordine/ }).click();
  await expect(page.getByRole("heading", { name: "Ordine confermato!" })).toBeVisible();

  // Order history and the address saved at checkout.
  await page.goto("/account/ordini");
  await expect(page.getByText(/#[A-Z]+\d+/).first()).toBeVisible();
  await page.goto("/account/indirizzi");
  await expect(page.getByText("Via Ruggero Settimo").first()).toBeVisible();

  // Second order, already signed in: the "your details" step is skipped and the order uses the
  // account's name and e-mail. Nothing asks for the name; only a missing phone may be requested.
  await page.goto("/menu");
  await addFromMenu(page, DISHES.ravioli, 6);
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Contanti alla consegna/ })).toBeVisible();
  // The review shows (and lets edit) name, phone and e-mail, filled in from the account.
  await expect(page.getByLabel("Nome e cognome")).toHaveValue("Sara Cliente");
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
  const phone = page.getByLabel(/Telefono/);
  if (await phone.count()) await phone.fill("+39 333 222 3333");
  await page.getByRole("radio", { name: /Contanti alla consegna/ }).click();
  await page.getByRole("button", { name: /Conferma ordine/ }).click();
  await expect(page.getByRole("heading", { name: "Ordine confermato!" })).toBeVisible();

  // The order emptied the cart: on this device and on the account, so it does not come back when
  // the customer returns to the shop (or signs in elsewhere).
  const remote = await page.request.get("/api/v1/me/cart");
  expect((await remote.json()) as { lines: unknown[] }).toMatchObject({ lines: [] });
  await page.goto("/cart");
  await expect(page.getByText("Il carrello è vuoto")).toBeVisible();
  await page.goto("/menu");
  await page.goto("/cart");
  await expect(page.getByText("Il carrello è vuoto")).toBeVisible();
});
