import { addFromMenu, DISHES, expect, openAs, orderNumberFrom, staff, test } from "../helpers";

/**
 * Guest → menu → cart → checkout as guest (pickup, online payment) → confirmation → live tracking;
 * the kitchen accepts, prepares and hands the order over, the customer sees every step.
 */
test("ordine da ospite con ritiro, gestito dalla cucina in tempo reale", async ({ page, browser }) => {
  await page.goto("/menu");
  await expect(page.getByRole("heading", { name: "Menu", level: 1 })).toBeVisible();
  await addFromMenu(page, DISHES.ravioli, 3);

  await page.goto("/cart");
  await expect(page.getByText(DISHES.ravioli).first()).toBeVisible();
  await page
    .getByRole("link", { name: /Vai al checkout/ })
    .or(page.getByRole("button", { name: /Vai al checkout/ }))
    .first()
    .click();
  await page.waitForURL("**/checkout");

  // Step 1: pickup.
  await page
    .getByRole("radio", { name: /Ritiro/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continua", exact: true }).click();

  // Step 2: "Come vuoi continuare?" only now, after the order details.
  await expect(page.getByText("Come vuoi continuare?")).toBeVisible();
  await page.getByRole("button", { name: /Continua come ospite/ }).click();
  await page.getByLabel("Nome e cognome").fill("Giulia Ospite");
  await page.getByLabel(/E-mail/).fill(`giulia.${Date.now()}@example.com`);
  await page.getByLabel(/Telefono/).fill("+39 333 765 4321");
  await page.getByRole("button", { name: "Continua", exact: true }).click();

  // Step 3: pay (local payment simulator: the order is confirmed by the server, not the browser).
  await page.getByRole("button", { name: /Conferma e paga/ }).click();
  await page.getByRole("button", { name: /^Paga € / }).click();
  await expect(page.getByRole("heading", { name: "Ordine confermato!" })).toBeVisible();
  const number = orderNumberFrom(
    await page
      .getByText(/^#[A-Z]+\d+$/)
      .first()
      .innerText(),
  );
  await page.getByRole("button", { name: "Segui il tuo ordine" }).click();
  await expect(
    page
      .getByText(`Ordine #${number}`.toUpperCase())
      .or(page.getByText(`#${number}`))
      .first(),
  ).toBeVisible();

  // The kitchen tablet.
  const kitchen = await openAs(browser, staff(), { next: "/admin/cucina" });
  // The ticket the cook sees (the board renders one layout per screen size).
  const ticket = kitchen.locator("article", { hasText: `#${number}` }).filter({ visible: true });
  await expect(ticket).toBeVisible();
  await ticket.getByRole("button", { name: "Accetta" }).click();
  await kitchen.getByRole("button", { name: "15 minuti" }).click();
  await kitchen.getByRole("button", { name: /Accetta · pronto in 15 min/ }).click();
  await expect(page.getByText("Confermato").first()).toBeVisible();

  await ticket.getByRole("button", { name: "Pronto" }).click();
  // Realtime: the customer sees the order ready without reloading.
  await expect(page.getByText("Pronto per il ritiro").first()).toBeVisible();

  await ticket.getByRole("button", { name: "Ritirato dal cliente" }).click();
  await expect(page.getByText(/Ritirato|Buon appetito/).first()).toBeVisible();
  await kitchen.context().close();
});
