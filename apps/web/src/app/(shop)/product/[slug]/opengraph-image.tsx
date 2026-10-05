import fs from "node:fs/promises";
import path from "node:path";
import { formatEuro } from "@dimsum/domain";
import { ImageResponse } from "next/og";
import { LOGO } from "@/components/brand/logo-data";
import { getProductBySlug } from "@/server/services/catalog";

export const alt = "Piatto del menu DIMSUM";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview: real dish photo, name, price and the DIMSUM wordmark. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getProductBySlug(slug);
  let photo: string | null = null;
  if (found?.product.image) {
    // OG renderers cannot decode WebP: convert the bundled photo to JPEG.
    const sharp = (await import("sharp")).default;
    const file = path.join(process.cwd(), "public", found.product.image.url);
    const jpeg = await sharp(await fs.readFile(file))
      .resize(700, 630, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    photo = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  }
  const x0 = LOGO.wordmark.x0 - 1;
  const w = LOGO.wordmark.width - LOGO.wordmark.x0 + 2;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0e0d0c", color: "white" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 520,
          padding: 56,
        }}
      >
        <svg viewBox={`${x0} -1 ${w} ${LOGO.wordmark.height + 2}`} width={260} height={34}>
          <path d={LOGO.wordmark.d} fill="#ffffff" />
          <path d={LOGO.seal.d} fill="#e8382b" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>
            {found?.product.name ?? "DIMSUM"}
          </div>
          {found ? (
            <div style={{ marginTop: 18, fontSize: 34, fontWeight: 700, color: "#ee5446" }}>
              {formatEuro(found.product.priceCents)}
            </div>
          ) : null}
        </div>
        <div style={{ fontSize: 22, color: "#b8b0a6" }}>Asian street food · Palermo · Ordina online</div>
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser
        <img src={photo} width={680} height={630} alt="" style={{ objectFit: "cover" }} />
      ) : null}
    </div>,
    size,
  );
}
