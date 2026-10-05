import { json } from "@/server/http";
import { apiRoute } from "@/server/http";
import { getCatalog } from "@/server/services/catalog";

export const GET = apiRoute({ auth: "public" }, async () => {
  const catalog = await getCatalog();
  // Short shared cache: availability changes are also pushed over realtime.
  return json(catalog, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      ETag: `"${catalog.version}"`,
    },
  });
});
