import { can } from "@dimsum/domain";
import { orderCommandRequest } from "@dimsum/validation";
import { AppError } from "@/server/errors";
import { apiRoute, parseId } from "@/server/http";
import { getAdminOrder } from "@/server/services/admin/orders";
import { runOrderCommand, updatePrepTime } from "@/server/services/orders/commands";

/** Kitchen and dispatch actions (accept, ready, assign rider…), validated by the order state machine. */
export const POST = apiRoute<{ id: string }>(
  {
    auth: "orders:manage",
    rateLimit: { name: "admin-order-command", limit: 120, windowSeconds: 60, by: "user" },
  },
  async ({ params, body, viewer }) => {
    const orderId = parseId(params.id, "Ordine");
    const input = await body(orderCommandRequest);
    const ctx = { actor: "staff" as const, userId: viewer!.userId, role: viewer!.role };
    if (
      (input.command === "ASSIGN_RIDER" || input.command === "UNASSIGN_RIDER") &&
      !can(viewer!.role, "riders:assign")
    )
      throw new AppError("FORBIDDEN");
    switch (input.command) {
      case "UPDATE_PREP_TIME":
        await updatePrepTime(orderId, input.prepMinutes, ctx);
        break;
      case "CONFIRM":
        await runOrderCommand(orderId, { type: "CONFIRM", prepMinutes: input.prepMinutes }, ctx);
        break;
      case "REJECT":
      case "CANCEL":
        await runOrderCommand(orderId, { type: input.command, reason: input.reason }, ctx);
        break;
      case "ASSIGN_RIDER":
        await runOrderCommand(orderId, { type: "ASSIGN_RIDER", riderId: input.riderId }, ctx);
        break;
      default:
        await runOrderCommand(orderId, { type: input.command }, ctx);
    }
    return getAdminOrder(orderId);
  },
);
