import { apiRoute } from "@/server/http";
import { getRestaurantPublic } from "@/server/services/restaurant";

export const GET = apiRoute({ auth: "public" }, async () => getRestaurantPublic());
