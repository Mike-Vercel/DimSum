import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// Only real HTTPS deployments (Vercel, or APP_URL on https) upgrade sub-requests: a local
// production run is plain http.
const https = !!process.env.VERCEL || (process.env.APP_URL ?? "").startsWith("https://");
// Address search runs on the customer device with the OpenStreetMap provider (lib/geo/geocoder.ts).
const geocoder = new URL(process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org").origin;

/**
 * Content Security Policy without nonces: menu and storefront pages are prerendered (Cache
 * Components / partial prerendering), which nonce-based CSP does not support. Third parties are
 * restricted to the payment and map providers actually used.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://maps.googleapis.com https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${geocoder} https://api.stripe.com https://m.stripe.network https://*.openfreemap.org https://tiles.openfreemap.org https://maps.googleapis.com https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  ...(https ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")',
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // The end-to-end suite builds into its own folder so it never clashes with `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactCompiler: true,
  cacheComponents: true,
  // No floating "N" badge in development: it covers the app's bottom bar and buttons on phones.
  // Compile and runtime errors are still shown.
  devIndicators: false,
  poweredByHeader: false,
  // Social preview images read the bundled menu photos from disk.
  outputFileTracingIncludes: {
    // Keys are route globs (picomatch): match the generated image routes.
    "/opengraph-image*": ["./public/menu/**/*"],
    "/product/*/opengraph-image*": ["./public/menu/**/*"],
  },
  transpilePackages: [
    "@dimsum/api-client",
    "@dimsum/db",
    "@dimsum/domain",
    "@dimsum/types",
    "@dimsum/validation",
  ],
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "sharp", "web-push", "nodemailer"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 85],
    minimumCacheTTL: 7 * 24 * 3600,
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: {
    // Inline the critical CSS of the static shell for faster first paint on mobile networks.
    inlineCss: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/menu/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
      {
        source: "/.well-known/:file*",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
