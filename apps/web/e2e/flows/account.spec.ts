import { addFromMenu, DISHES, expect, rememberDeliveryAddress, test } from "../helpers";

/**
 * Account journey (the Google button follows the same redirect path, see README):
 * registration → sign out → cart filled as a guest → "Accedi con e-mail" from the checkout →
 * back to the checkout with the cart intact → order with a saved address → order history.
 */
test("login dal checkout: carrello conservato, indirizzo salvato, storico ordini", async ({ page }) => {
  const email = `cliente.${Date.now()}@example.com`;
  const password = "Ravioli-al-vapore-2026";

  await page.goto("/registrati");
  await page.getByLabel("Nome e cognome").fill("Sara Cliente");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Crea account" }).click();
  await page.waitForURL("**/account");
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
});
