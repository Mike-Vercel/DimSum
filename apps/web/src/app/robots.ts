import type { MetadataRoute } from "next";
import { appUrl } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private or per-customer pages: never indexed.
        disallow: [
          "/api/",
          "/admin",
          "/rider",
          "/account",
          "/checkout",
          "/cart",
          "/order/",
          "/login",
          "/registrati",
          "/password-dimenticata",
          "/reimposta-password",
          "/promo/",
        ],
      },
    ],
    sitemap: appUrl("/sitemap.xml"),
    host: appUrl("/"),
  };
}
