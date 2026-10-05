import { env } from "@/server/env";

/** iOS Universal Links for the future app: products, orders, promos and account pages. */
export function GET() {
  const e = env();
  const appID = e.APPLE_TEAM_ID && e.IOS_BUNDLE_ID ? `${e.APPLE_TEAM_ID}.${e.IOS_BUNDLE_ID}` : null;
  const body = {
    applinks: {
      details: appID
        ? [
            {
              appIDs: [appID],
              components: [
                { "/": "/product/*" },
                { "/": "/order/*" },
                { "/": "/promo/*" },
                { "/": "/menu" },
                { "/": "/account/*" },
              ],
            },
          ]
        : [],
    },
    webcredentials: { apps: appID ? [appID] : [] },
  };
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
