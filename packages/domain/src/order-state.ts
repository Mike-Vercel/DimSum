/**
 * Order lifecycle.
 *
 * Kitchen and delivery progress in parallel (a rider can be assigned while the food is being
 * prepared), so the order stores one timestamp per milestone and the public `status` is DERIVED
 * from them. Every command is validated here before the server persists it; the server records
 * each accepted command in OrderStatusHistory with the status it produced.
 */
import type { FulfillmentType, OrderStatus, PaymentMethod } from "@dimsum/types";

export interface OrderMilestones {
  paidAt: Date | null;
  receivedAt: Date | null;
  confirmedAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  riderAssignedAt: Date | null;
  riderToRestaurantAt: Date | null;
  pickedUpAt: Date | null;
  onTheWayAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
}

export const EMPTY_MILESTONES: OrderMilestones = {
  paidAt: null,
  receivedAt: null,
  confirmedAt: null,
  preparingAt: null,
  readyAt: null,
  riderAssignedAt: null,
  riderToRestaurantAt: null,
  pickedUpAt: null,
  onTheWayAt: null,
  deliveredAt: null,
  cancelledAt: null,
  refundedAt: null,
};

export interface OrderState {
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  milestones: OrderMilestones;
}

export type Actor = "customer" | "staff" | "rider" | "system";

export type OrderCommand =
  | { type: "PAYMENT_SUCCEEDED" }
  | { type: "RECEIVE" }
  | { type: "CONFIRM"; prepMinutes: number }
  | { type: "REJECT"; reason: string }
  | { type: "START_PREPARING" }
  | { type: "MARK_READY" }
  | { type: "ASSIGN_RIDER"; riderId: string }
  | { type: "UNASSIGN_RIDER" }
  | { type: "RIDER_TO_RESTAURANT" }
  | { type: "PICK_UP" }
  | { type: "START_DELIVERY" }
  | { type: "DELIVER" }
  | { type: "CANCEL"; reason: string }
  | { type: "REFUND_FULL" };

export type OrderCommandType = OrderCommand["type"];

export type TransitionError =
  | "ALREADY_DONE"
  | "NOT_PAID"
  | "NOT_RECEIVED"
  | "NOT_CONFIRMED"
  | "ALREADY_CONFIRMED"
  | "ALREADY_READY"
  | "NOT_DELIVERY_ORDER"
  | "NO_RIDER"
  | "ALREADY_PICKED_UP"
  | "NOT_PICKED_UP"
  | "ORDER_CLOSED"
  | "INVALID_PREP_TIME"
  | "FORBIDDEN"
  | "NOT_REFUNDABLE";

export type TransitionResult =
  | { ok: true; milestones: OrderMilestones; status: OrderStatus; recordedStatus: OrderStatus }
  | { ok: false; error: TransitionError; message: string };

const COMMAND_ACTORS: Record<OrderCommandType, readonly Actor[]> = {
  PAYMENT_SUCCEEDED: ["system"],
  RECEIVE: ["system"],
  CONFIRM: ["staff", "system"],
  REJECT: ["staff"],
  START_PREPARING: ["staff"],
  MARK_READY: ["staff"],
  ASSIGN_RIDER: ["staff", "system"],
  UNASSIGN_RIDER: ["staff", "system"],
  RIDER_TO_RESTAURANT: ["rider", "staff"],
  PICK_UP: ["rider", "staff"],
  START_DELIVERY: ["rider", "staff"],
  DELIVER: ["rider", "staff"],
  CANCEL: ["customer", "staff", "system"],
  REFUND_FULL: ["staff", "system"],
};

export function deriveStatus(state: OrderState): OrderStatus {
  const m = state.milestones;
  const isDelivery = state.fulfillmentType === "DELIVERY";
  if (m.refundedAt) return "REFUNDED";
  if (m.cancelledAt) return "CANCELLED";
  if (m.deliveredAt) return "DELIVERED";
  if (isDelivery && m.onTheWayAt) return "ON_THE_WAY";
  if (isDelivery && m.pickedUpAt) return "PICKED_UP";
  if (m.readyAt) {
    if (isDelivery && m.riderToRestaurantAt) return "RIDER_TO_RESTAURANT";
    if (isDelivery && m.riderAssignedAt) return "RIDER_ASSIGNED";
    return "READY_FOR_PICKUP";
  }
  if (m.preparingAt) return "PREPARING";
  if (m.confirmedAt) return "CONFIRMED";
  if (m.receivedAt) return "RECEIVED";
  if (m.paidAt) return "PAID";
  return "PENDING_PAYMENT";
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "DELIVERED" || status === "CANCELLED" || status === "REFUNDED";
}

/** Orders that still need work from kitchen or riders. */
export function isActive(status: OrderStatus): boolean {
  return !isTerminal(status) && status !== "PENDING_PAYMENT";
}

const fail = (error: TransitionError, message: string): TransitionResult => ({ ok: false, error, message });

export function applyCommand(
  state: OrderState,
  command: OrderCommand,
  actor: Actor,
  now: Date,
): TransitionResult {
  if (!COMMAND_ACTORS[command.type].includes(actor)) {
    return fail("FORBIDDEN", "Operazione non consentita per questo ruolo.");
  }
  const m = { ...state.milestones };
  const isDelivery = state.fulfillmentType === "DELIVERY";
  const closed = !!(m.cancelledAt || m.refundedAt);
  let recorded: OrderStatus | null = null;

  switch (command.type) {
    case "PAYMENT_SUCCEEDED": {
      if (m.paidAt) return fail("ALREADY_DONE", "Pagamento già registrato.");
      if (closed)
        return fail("ORDER_CLOSED", "L'ordine è stato annullato prima della conferma del pagamento.");
      m.paidAt = now;
      recorded = "PAID";
      break;
    }
    case "RECEIVE": {
      if (m.receivedAt) return fail("ALREADY_DONE", "Ordine già ricevuto.");
      if (closed) return fail("ORDER_CLOSED", "Ordine annullato.");
      if (state.paymentMethod === "ONLINE" && !m.paidAt)
        return fail("NOT_PAID", "Pagamento non ancora confermato.");
      m.receivedAt = now;
      recorded = "RECEIVED";
      break;
    }
    case "CONFIRM": {
      if (closed) return fail("ORDER_CLOSED", "Ordine annullato.");
      if (!m.receivedAt) return fail("NOT_RECEIVED", "L'ordine non è ancora stato ricevuto.");
      if (m.confirmedAt) return fail("ALREADY_CONFIRMED", "Ordine già accettato.");
      if (!Number.isInteger(command.prepMinutes) || command.prepMinutes < 1 || command.prepMinutes > 240) {
        return fail("INVALID_PREP_TIME", "Tempo di preparazione non valido.");
      }
      m.confirmedAt = now;
      recorded = "CONFIRMED";
      break;
    }
    case "REJECT": {
      if (closed) return fail("ORDER_CLOSED", "Ordine già annullato.");
      if (!m.receivedAt) return fail("NOT_RECEIVED", "L'ordine non è ancora stato ricevuto.");
      if (m.confirmedAt) return fail("ALREADY_CONFIRMED", "L'ordine è già stato accettato: usa Annulla.");
      m.cancelledAt = now;
      recorded = "CANCELLED";
      break;
    }
    case "START_PREPARING": {
      if (closed) return fail("ORDER_CLOSED", "Ordine annullato.");
      if (!m.confirmedAt) return fail("NOT_CONFIRMED", "Accetta l'ordine prima di iniziare la preparazione.");
      if (m.preparingAt) return fail("ALREADY_DONE", "Preparazione già iniziata.");
      if (m.readyAt) return fail("ALREADY_READY", "Ordine già pronto.");
      m.preparingAt = now;
      recorded = "PREPARING";
      break;
    }
    case "MARK_READY": {
      if (closed) return fail("ORDER_CLOSED", "Ordine annullato.");
      if (!m.confirmedAt) return fail("NOT_CONFIRMED", "Accetta l'ordine prima di segnarlo pronto.");
      if (m.readyAt) return fail("ALREADY_READY", "Ordine già pronto.");
      m.preparingAt ??= now;
      m.readyAt = now;
      recorded = "READY_FOR_PICKUP";
      break;
    }
    case "ASSIGN_RIDER": {
      if (!isDelivery) return fail("NOT_DELIVERY_ORDER", "Gli ordini da ritirare non hanno un rider.");
      if (closed || m.deliveredAt) return fail("ORDER_CLOSED", "Ordine chiuso.");
      if (!m.receivedAt) return fail("NOT_RECEIVED", "L'ordine non è ancora stato ricevuto.");
      if (m.pickedUpAt) return fail("ALREADY_PICKED_UP", "L'ordine è già stato ritirato.");
      // Re-assignment resets the rider's own progress.
      m.riderAssignedAt = now;
      m.riderToRestaurantAt = null;
      recorded = "RIDER_ASSIGNED";
      break;
    }
    case "UNASSIGN_RIDER": {
      if (!isDelivery) return fail("NOT_DELIVERY_ORDER", "Gli ordini da ritirare non hanno un rider.");
      if (!m.riderAssignedAt) return fail("NO_RIDER", "Nessun rider assegnato.");
      if (m.pickedUpAt) return fail("ALREADY_PICKED_UP", "L'ordine è già stato ritirato.");
      m.riderAssignedAt = null;
      m.riderToRestaurantAt = null;
      recorded = m.readyAt ? "READY_FOR_PICKUP" : deriveStatus({ ...state, milestones: m });
      break;
    }
    case "RIDER_TO_RESTAURANT": {
      if (!isDelivery) return fail("NOT_DELIVERY_ORDER", "Ordine da ritirare.");
      if (closed) return fail("ORDER_CLOSED", "Ordine annullato.");
      if (!m.riderAssignedAt) return fail("NO_RIDER", "Nessun rider assegnato.");
      if (m.pickedUpAt) return fail("ALREADY_PICKED_UP", "L'ordine è già stato ritirato.");
      if (m.riderToRestaurantAt)
        return fail("ALREADY_DONE", "Il rider è già in viaggio verso il ristorante.");
      m.riderToRestaurantAt = now;
      recorded = "RIDER_TO_RESTAURANT";
      break;
    }
    case "PICK_UP": {
      if (!isDelivery) return fail("NOT_DELIVERY_ORDER", "Ordine da ritirare: usa Consegnato.");
      if (closed) return fail("ORDER_CLOSED", "Ordine annullato.");
      if (!m.riderAssignedAt) return fail("NO_RIDER", "Nessun rider assegnato.");
      if (!m.confirmedAt) return fail("NOT_CONFIRMED", "L'ordine non è ancora stato accettato dalla cucina.");
      if (m.pickedUpAt) return fail("ALREADY_PICKED_UP", "Ordine già ritirato.");
      // The handover proves the food is ready even if the kitchen forgot to press the button.
      m.preparingAt ??= now;
      m.readyAt ??= now;
      m.riderToRestaurantAt ??= now;
      m.pickedUpAt = now;
      recorded = "PICKED_UP";
      break;
    }
    case "START_DELIVERY": {
      if (!isDelivery) return fail("NOT_DELIVERY_ORDER", "Ordine da ritirare.");
      if (closed) return fail("ORDER_CLOSED", "Ordine annullato.");
      if (!m.pickedUpAt) return fail("NOT_PICKED_UP", "Ritira prima l'ordine al ristorante.");
      if (m.onTheWayAt) return fail("ALREADY_DONE", "Consegna già avviata.");
      m.onTheWayAt = now;
      recorded = "ON_THE_WAY";
      break;
    }
    case "DELIVER": {
      if (closed) return fail("ORDER_CLOSED", "Ordine annullato.");
      if (m.deliveredAt) return fail("ALREADY_DONE", "Ordine già consegnato.");
      if (isDelivery) {
        if (!m.pickedUpAt) return fail("NOT_PICKED_UP", "L'ordine non è ancora stato ritirato dal rider.");
        m.onTheWayAt ??= now;
      } else {
        if (!m.confirmedAt) return fail("NOT_CONFIRMED", "L'ordine non è ancora stato accettato.");
        m.preparingAt ??= now;
        m.readyAt ??= now;
      }
      m.deliveredAt = now;
      recorded = "DELIVERED";
      break;
    }
    case "CANCEL": {
      if (closed) return fail("ORDER_CLOSED", "Ordine già annullato.");
      if (m.deliveredAt) return fail("ORDER_CLOSED", "L'ordine è già stato consegnato: usa il rimborso.");
      if (actor === "customer" && m.confirmedAt) {
        return fail("ALREADY_CONFIRMED", "La cucina ha già accettato l'ordine: contatta l'assistenza.");
      }
      m.cancelledAt = now;
      recorded = "CANCELLED";
      break;
    }
    case "REFUND_FULL": {
      if (!m.paidAt) return fail("NOT_REFUNDABLE", "Nessun pagamento online da rimborsare.");
      if (m.refundedAt) return fail("ALREADY_DONE", "Ordine già rimborsato.");
      m.refundedAt = now;
      recorded = "REFUNDED";
      break;
    }
  }

  const status = deriveStatus({ ...state, milestones: m });
  return { ok: true, milestones: m, status, recordedStatus: recorded ?? status };
}

/** Commands the given actor can run now; drives the buttons shown in KDS, admin and rider apps. */
export function availableCommands(state: OrderState, actor: Actor): OrderCommandType[] {
  const probes: OrderCommand[] = [
    { type: "CONFIRM", prepMinutes: 15 },
    { type: "REJECT", reason: "probe" },
    { type: "START_PREPARING" },
    { type: "MARK_READY" },
    { type: "ASSIGN_RIDER", riderId: "probe" },
    { type: "UNASSIGN_RIDER" },
    { type: "RIDER_TO_RESTAURANT" },
    { type: "PICK_UP" },
    { type: "START_DELIVERY" },
    { type: "DELIVER" },
    { type: "CANCEL", reason: "probe" },
    { type: "REFUND_FULL" },
  ];
  const now = new Date();
  return probes.filter((c) => applyCommand(state, c, actor, now).ok).map((c) => c.type);
}

export interface TimelineStep {
  key: "received" | "confirmed" | "preparing" | "ready" | "rider" | "on_the_way" | "delivered";
  label: string;
  at: Date | null;
  state: "done" | "current" | "upcoming";
}

/** Customer-facing timeline. Steps can complete out of order (rider assigned during preparation). */
export function buildTimeline(state: OrderState): TimelineStep[] {
  const m = state.milestones;
  const isDelivery = state.fulfillmentType === "DELIVERY";
  const steps: Omit<TimelineStep, "state">[] = [
    { key: "received", label: "Ordine ricevuto", at: m.receivedAt },
    { key: "confirmed", label: "Confermato", at: m.confirmedAt },
    { key: "preparing", label: "In preparazione", at: m.preparingAt },
    { key: "ready", label: isDelivery ? "Pronto" : "Pronto per il ritiro", at: m.readyAt },
  ];
  if (isDelivery) {
    steps.push(
      { key: "rider", label: "Rider assegnato", at: m.riderAssignedAt },
      { key: "on_the_way", label: "In consegna", at: m.onTheWayAt ?? m.pickedUpAt },
      { key: "delivered", label: "Consegnato", at: m.deliveredAt },
    );
  } else {
    steps.push({ key: "delivered", label: "Ritirato", at: m.deliveredAt });
  }
  const firstOpen = steps.findIndex((s) => !s.at);
  return steps.map((s, i) => ({
    ...s,
    state: s.at ? "done" : i === firstOpen && !m.cancelledAt ? "current" : "upcoming",
  }));
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "In attesa di pagamento",
  PAID: "Pagato",
  RECEIVED: "Ricevuto",
  CONFIRMED: "Confermato",
  PREPARING: "In preparazione",
  READY_FOR_PICKUP: "Pronto",
  RIDER_ASSIGNED: "Rider assegnato",
  RIDER_TO_RESTAURANT: "Rider in arrivo al ristorante",
  PICKED_UP: "Ritirato dal rider",
  ON_THE_WAY: "In consegna",
  DELIVERED: "Consegnato",
  CANCELLED: "Annullato",
  REFUNDED: "Rimborsato",
};

/** Kanban columns of the kitchen display. */
export type KitchenColumn = "NEW" | "ACCEPTED" | "PREPARING" | "READY" | "OUT";

export function kitchenColumn(status: OrderStatus): KitchenColumn | null {
  switch (status) {
    case "RECEIVED":
      return "NEW";
    case "CONFIRMED":
      return "ACCEPTED";
    case "PREPARING":
      return "PREPARING";
    case "READY_FOR_PICKUP":
    case "RIDER_ASSIGNED":
    case "RIDER_TO_RESTAURANT":
      return "READY";
    case "PICKED_UP":
    case "ON_THE_WAY":
      return "OUT";
    default:
      return null;
  }
}
