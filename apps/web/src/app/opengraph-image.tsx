import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { LOGO } from "@/components/brand/logo-data";
import { getCatalog } from "@/server/services/catalog";

export const alt = "DIMSUM · Asian street food a Palermo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social preview: the wordmark and three real dishes from the menu. */
export default async function Image() {
  const catalog = await getCatalog();
  const sharp = (await import("sharp")).default;
  const picks = catalog.bestsellerIds
    .map((id) => catalog.products[id])
    .filter((p) => p?.image?.backdrop === "DARK")
    .slice(0, 3);
  const photos = await Promise.all(
    picks.map(async (p) => {
      // Social crawlers cannot decode WebP: convert the bundled photo to JPEG.
      const file = path.join(process.cwd(), "public", p!.image!.url);
      const jpeg = await sharp(await fs.readFile(file))
        .resize(400, 630, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }),
  );
  const x0 = LOGO.wordmark.x0 - 1;
  const w = LOGO.wordmark.width - LOGO.wordmark.x0 + 2;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0e0d0c" }}>
      {photos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser
        <img
          key={i}
          src={src}
          width={400}
          height={630}
          alt=""
          style={{ objectFit: "cover", opacity: 0.55 }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, rgba(14,13,12,0.2), rgba(14,13,12,0.85))",
        }}
      >
        <svg viewBox={`${x0} -1 ${w} ${LOGO.wordmark.height + 2}`} width={620} height={82}>
          <path d={LOGO.wordmark.d} fill="#ffffff" />
          <path d={LOGO.seal.d} fill="#e8382b" />
        </svg>
        <div style={{ marginTop: 28, fontSize: 34, color: "#f6f1ea", letterSpacing: 6 }}>
          ASIAN STREET FOOD · PALERMO
        </div>
        <div style={{ marginTop: 18, fontSize: 28, color: "#ee5446", fontWeight: 700 }}>
          Ordina online: consegna o ritiro
        </div>
      </div>
    </div>,
    size,
  );
}
