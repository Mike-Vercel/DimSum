import {
  addFromMenu,
  DISHES,
  expect,
  openAs,
  orderNumberFrom,
  rememberDeliveryAddress,
  rider,
  staff,
  test,
} from "../helpers";

/**
 * The complete delivery chain: guest order with cash on delivery → kitchen accepts and prepares →
 * dispatch assigns the rider → rider app: to the restaurant, pickup, on the way, delivered with
 * cash → the customer follows every step on the tracking page.
 */
test("consegna completa: cucina, rider e tracking del cliente", async ({ page, browser }) => {
  await rememberDeliveryAddress(page);
  await page.goto("/menu");
  await addFromMenu(page, DISHES.ravioli, 4);
  await addFromMenu(page, DISHES.noodles, 1);

  await page.goto("/checkout");
  await expect(page.getByText("Via Ruggero Settimo 20").first()).toBeVisible();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page.getByRole("button", { name: /Continua come ospite/ }).click();
  await page.getByLabel("Nome e cognome").fill("Marco Consegna");
  await page.getByLabel(/E-mail/).fill(`marco.${Date.now()}@example.com`);
  await page.getByLabel(/Telefono/).fill("+39 333 111 2222");
  await page.getByRole("button", { name: "Continua", exact: true }).click();

  await page.getByRole("radio", { name: /Contanti alla consegna/ }).click();
  await page.getByRole("button", { name: /Conferma ordine/ }).click();
  await expect(page.getByRole("heading", { name: "Ordine confermato!" })).toBeVisible();
  const number = orderNumberFrom(
    await page
      .getByText(/^#[A-Z]+\d+$/)
      .first()
      .innerText(),
  );
  await page.getByRole("button", { name: "Segui il tuo ordine" }).click();

  // Rider starts the shift on the phone.
  const riderPhone = await openAs(browser, rider(), { mobile: true, path: "/rider/login", next: "/rider" });
  const startShift = riderPhone.getByRole("button", { name: "Inizia il turno" });
  const waiting = riderPhone.getByText("In attesa di consegne");
  await expect(startShift.or(waiting)).toBeVisible();
  if (await startShift.isVisible()) await startShift.click();
  await expect(waiting).toBeVisible();

  // Kitchen: accept, ready, assign the rider.
  const kitchen = await openAs(browser, staff(), { next: "/admin/cucina" });
  // The ticket the cook sees (the board renders one layout per screen size).
  const ticket = kitchen.locator("article", { hasText: `#${number}` }).filter({ visible: true });
  await ticket.getByRole("button", { name: "Accetta" }).click();
  await kitchen.getByRole("button", { name: "20 minuti" }).click();
  await kitchen.getByRole("button", { name: /Accetta · pronto in 20 min/ }).click();
  await ticket.getByRole("button", { name: "Pronto" }).click();
  await ticket.getByRole("button", { name: /Assegna rider/ }).click();
  await kitchen.getByRole("button", { name: /Luca/ }).click();
  await expect(page.getByText(/Rider assegnato/).first()).toBeVisible();

  // Rider app, step by step (realtime brings the assignment in).
  const card = riderPhone.locator("article", { hasText: `#${number}` });
  await expect(card).toBeVisible();
  await expect(card.getByText(/Incassa € .* in contanti/)).toBeVisible();
  await card.getByRole("button", { name: "Vado al ristorante" }).click();
  await card.getByRole("button", { name: "Sono al ristorante" }).click();
  await card.getByRole("button", { name: "Ho ritirato l'ordine" }).click();
  await expect(page.getByText(/In consegna|in viaggio/).first()).toBeVisible();
  await card.getByRole("button", { name: "Parto per la consegna" }).click();
  await card.getByRole("button", { name: "Consegnato" }).click();
  await riderPhone.getByRole("button", { name: /Incassato € .* Consegnato/ }).click();
  await expect(riderPhone.getByText("Consegne oggi")).toBeVisible();

  await expect(page.getByText(/Consegnato|Buon appetito/).first()).toBeVisible();
  await riderPhone.context().close();
  await kitchen.context().close();
});
