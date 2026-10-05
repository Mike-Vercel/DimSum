import { apiRoute } from "@/server/http";
import { getAdminCatalog } from "@/server/services/admin/catalog";

export const GET = apiRoute({ auth: "catalog:availability" }, async () => getAdminCatalog());
