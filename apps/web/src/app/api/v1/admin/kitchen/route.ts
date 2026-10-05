import { apiRoute } from "@/server/http";
import { getKitchenBoard } from "@/server/services/admin/orders";
import { scheduleOperations } from "@/server/services/operations";

export const GET = apiRoute({ auth: "orders:read" }, async () => {
  scheduleOperations();
  return getKitchenBoard();
});
