import { describe, expect, it } from "vitest";
import {
  EMPTY_MILESTONES,
  applyCommand,
  availableCommands,
  buildTimeline,
  deriveStatus,
  kitchenColumn,
  type Actor,
  type OrderCommand,
  type OrderState,
} from "../src";

const t0 = new Date("2026-10-05T18:00:00Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);

function run(state: OrderState, steps: [OrderCommand, Actor][]): OrderState {
  return steps.reduce((s, [cmd, actor], i) => {
    const r = applyCommand(s, cmd, actor, at(i + 1));
    if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
    return { ...s, milestones: r.milestones };
  }, state);
}

const delivery: OrderState = {
  fulfillmentType: "DELIVERY",
  paymentMethod: "ONLINE",
  milestones: EMPTY_MILESTONES,
};
const pickup: OrderState = {
  fulfillmentType: "PICKUP",
  paymentMethod: "ONLINE",
  milestones: EMPTY_MILESTONES,
};

describe("delivery order lifecycle", () => {
  it("walks the full happy path", () => {
    const s = run(delivery, [
      [{ type: "PAYMENT_SUCCEEDED" }, "system"],
      [{ type: "RECEIVE" }, "system"],
      [{ type: "CONFIRM", prepMinutes: 15 }, "staff"],
      [{ type: "START_PREPARING" }, "staff"],
      [{ type: "MARK_READY" }, "staff"],
      [{ type: "ASSIGN_RIDER", riderId: "r1" }, "staff"],
      [{ type: "RIDER_TO_RESTAURANT" }, "rider"],
      [{ type: "PICK_UP" }, "rider"],
      [{ type: "START_DELIVERY" }, "rider"],
      [{ type: "DELIVER" }, "rider"],
    ]);
    expect(deriveStatus(s)).toBe("DELIVERED");
    expect(buildTimeline(s).every((step) => step.state === "done")).toBe(true);
  });

  it("lets the rider be assigned while the kitchen is still cooking (overlapping phases)", () => {
    const s = run(delivery, [
      [{ type: "PAYMENT_SUCCEEDED" }, "system"],
      [{ type: "RECEIVE" }, "system"],
      [{ type: "CONFIRM", prepMinutes: 20 }, "staff"],
      [{ type: "START_PREPARING" }, "staff"],
      [{ type: "ASSIGN_RIDER", riderId: "r1" }, "staff"],
    ]);
    // Kitchen status wins until the food is ready.
    expect(deriveStatus(s)).toBe("PREPARING");
    const timeline = buildTimeline(s);
    expect(timeline.find((x) => x.key === "preparing")?.state).toBe("done");
    expect(timeline.find((x) => x.key === "ready")?.state).toBe("current");
    expect(timeline.find((x) => x.key === "rider")?.state).toBe("done");

    const ready = run(s, [[{ type: "MARK_READY" }, "staff"]]);
    expect(deriveStatus(ready)).toBe("RIDER_ASSIGNED");
    expect(kitchenColumn(deriveStatus(ready))).toBe("READY");
  });

  it("treats the rider handover as proof the food is ready", () => {
    const s = run(delivery, [
      [{ type: "PAYMENT_SUCCEEDED" }, "system"],
      [{ type: "RECEIVE" }, "system"],
      [{ type: "CONFIRM", prepMinutes: 10 }, "staff"],
      [{ type: "ASSIGN_RIDER", riderId: "r1" }, "staff"],
      [{ type: "PICK_UP" }, "rider"],
    ]);
    expect(deriveStatus(s)).toBe("PICKED_UP");
    expect(s.milestones.readyAt).not.toBeNull();
  });

  it("rejects invalid transitions server-side", () => {
    expect(applyCommand(delivery, { type: "RECEIVE" }, "system", t0)).toMatchObject({
      ok: false,
      error: "NOT_PAID",
    });
    expect(applyCommand(delivery, { type: "CONFIRM", prepMinutes: 15 }, "staff", t0)).toMatchObject({
      ok: false,
      error: "NOT_RECEIVED",
    });
    const received = run(delivery, [
      [{ type: "PAYMENT_SUCCEEDED" }, "system"],
      [{ type: "RECEIVE" }, "system"],
    ]);
    expect(applyCommand(received, { type: "PICK_UP" }, "rider", t0)).toMatchObject({
      ok: false,
      error: "NO_RIDER",
    });
    expect(applyCommand(received, { type: "DELIVER" }, "rider", t0)).toMatchObject({
      ok: false,
      error: "NOT_PICKED_UP",
    });
    expect(applyCommand(received, { type: "CONFIRM", prepMinutes: 0 }, "staff", t0)).toMatchObject({
      ok: false,
      error: "INVALID_PREP_TIME",
    });
    expect(applyCommand(received, { type: "PAYMENT_SUCCEEDED" }, "system", t0)).toMatchObject({
      ok: false,
      error: "ALREADY_DONE",
    });
  });

  it("enforces who may run each command", () => {
    const received = run(delivery, [
      [{ type: "PAYMENT_SUCCEEDED" }, "system"],
      [{ type: "RECEIVE" }, "system"],
    ]);
    expect(applyCommand(received, { type: "CONFIRM", prepMinutes: 15 }, "customer", t0)).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    });
    expect(applyCommand(received, { type: "CONFIRM", prepMinutes: 15 }, "rider", t0)).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    });
    expect(applyCommand(received, { type: "PAYMENT_SUCCEEDED" }, "staff", t0)).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it("lets customers cancel only before the kitchen accepts", () => {
    const received = run(delivery, [
      [{ type: "PAYMENT_SUCCEEDED" }, "system"],
      [{ type: "RECEIVE" }, "system"],
    ]);
    expect(
      applyCommand(received, { type: "CANCEL", reason: "ci ho ripensato" }, "customer", t0),
    ).toMatchObject({ ok: true, status: "CANCELLED" });
    const confirmed = run(received, [[{ type: "CONFIRM", prepMinutes: 15 }, "staff"]]);
    expect(applyCommand(confirmed, { type: "CANCEL", reason: "x" }, "customer", t0)).toMatchObject({
      ok: false,
      error: "ALREADY_CONFIRMED",
    });
    expect(applyCommand(confirmed, { type: "CANCEL", reason: "x" }, "staff", t0)).toMatchObject({ ok: true });
  });

  it("refunds only paid orders, once", () => {
    const cancelled = run(delivery, [
      [{ type: "PAYMENT_SUCCEEDED" }, "system"],
      [{ type: "RECEIVE" }, "system"],
      [{ type: "REJECT", reason: "chiusura cucina" }, "staff"],
    ]);
    const refunded = applyCommand(cancelled, { type: "REFUND_FULL" }, "staff", t0);
    expect(refunded).toMatchObject({ ok: true, status: "REFUNDED" });
    if (refunded.ok) {
      expect(
        applyCommand({ ...cancelled, milestones: refunded.milestones }, { type: "REFUND_FULL" }, "staff", t0),
      ).toMatchObject({
        ok: false,
        error: "ALREADY_DONE",
      });
    }
    const cash: OrderState = { ...delivery, paymentMethod: "CASH_ON_DELIVERY" };
    expect(applyCommand(cash, { type: "REFUND_FULL" }, "staff", t0)).toMatchObject({
      ok: false,
      error: "NOT_REFUNDABLE",
    });
  });
});

describe("pickup and cash orders", () => {
  it("receives cash orders without online payment", () => {
    const cash: OrderState = { ...pickup, paymentMethod: "CASH_ON_DELIVERY" };
    const r = applyCommand(cash, { type: "RECEIVE" }, "system", t0);
    expect(r).toMatchObject({ ok: true, status: "RECEIVED" });
  });

  it("completes a pickup when the customer collects it", () => {
    const s = run(pickup, [
      [{ type: "PAYMENT_SUCCEEDED" }, "system"],
      [{ type: "RECEIVE" }, "system"],
      [{ type: "CONFIRM", prepMinutes: 15 }, "staff"],
      [{ type: "MARK_READY" }, "staff"],
    ]);
    expect(deriveStatus(s)).toBe("READY_FOR_PICKUP");
    expect(applyCommand(s, { type: "ASSIGN_RIDER", riderId: "r" }, "staff", t0)).toMatchObject({
      ok: false,
      error: "NOT_DELIVERY_ORDER",
    });
    expect(availableCommands(s, "staff")).toContain("DELIVER");
    const done = run(s, [[{ type: "DELIVER" }, "staff"]]);
    expect(deriveStatus(done)).toBe("DELIVERED");
    expect(buildTimeline(done).map((x) => x.label)).toEqual([
      "Ordine ricevuto",
      "Confermato",
      "In preparazione",
      "Pronto per il ritiro",
      "Ritirato",
    ]);
  });
});
