import { apiRoute } from "@/server/http";
import { exportMyData } from "@/server/services/account";

/** Personal data download (GDPR): a JSON file the customer can keep or move elsewhere. */
export const GET = apiRoute(
  { auth: "user", rateLimit: { name: "me-export", limit: 5, windowSeconds: 3600, by: "user" } },
  async ({ viewer }) => {
    const data = await exportMyData(viewer!.userId);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dimsum-dati-personali-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
