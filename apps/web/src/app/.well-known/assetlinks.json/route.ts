import { env } from "@/server/env";

/** Android App Links: lets the future Android app open dimsum.it/product, /order and /promo links. */
export function GET() {
  const e = env();
  const fingerprints =
    e.ANDROID_SHA256_CERT_FINGERPRINTS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const body =
    e.ANDROID_PACKAGE_NAME && fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: e.ANDROID_PACKAGE_NAME,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
