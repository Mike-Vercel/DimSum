import { apiRoute } from "@/server/http";
import { getKitchenBoard } from "@/server/services/admin/orders";

export const GET = apiRoute({ auth: "orders:read" }, async () => getKitchenBoard());
