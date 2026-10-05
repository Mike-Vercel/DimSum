import type { MetadataRoute } from "next";

/** Installable customer app (Android, desktop; iOS uses the apple-touch metadata of the layout). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DIMSUM · Asian street food Palermo",
    short_name: "DIMSUM",
    description:
      "Ordina ravioli, bao e noodles da DIMSUM Palermo: consegna a domicilio o ritiro, con tracking in tempo reale.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f1ea",
    theme_color: "#f6f1ea",
    lang: "it",
    dir: "ltr",
    categories: ["food", "shopping"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Menu",
        short_name: "Menu",
        url: "/menu",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "I miei ordini",
        short_name: "Ordini",
        url: "/account/ordini",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Offerte",
        short_name: "Offerte",
        url: "/offerte",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
