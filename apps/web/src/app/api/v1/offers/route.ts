import { apiRoute } from "@/server/http";
import { getPublicOffers } from "@/server/services/offers";

export const GET = apiRoute({ auth: "public" }, async () => ({ coupons: await getPublicOffers() }));
