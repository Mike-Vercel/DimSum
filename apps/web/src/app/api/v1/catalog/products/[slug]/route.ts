import { notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { getProductBySlug } from "@/server/services/catalog";

export const GET = apiRoute<{ slug: string }>({ auth: "public" }, async ({ params }) => {
  const found = await getProductBySlug(params.slug);
  if (!found) throw notFound("Prodotto");
  return found.product;
});
