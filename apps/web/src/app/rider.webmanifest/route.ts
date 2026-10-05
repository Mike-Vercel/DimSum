/** Separate installable app for riders: opens straight on the deliveries screen. */
export function GET() {
  return Response.json(
    {
      name: "DIMSUM Rider",
      short_name: "Rider",
      id: "/rider",
      start_url: "/rider",
      scope: "/rider",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0e0d0c",
      theme_color: "#0e0d0c",
      lang: "it",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" } },
  );
}
