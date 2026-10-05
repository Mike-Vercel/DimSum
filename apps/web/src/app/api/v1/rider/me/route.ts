import { apiRoute } from "@/server/http";
import { getRiderHome } from "@/server/services/rider";

export const GET = apiRoute({ auth: "rider:self" }, async ({ viewer }) => getRiderHome(viewer!.userId));
