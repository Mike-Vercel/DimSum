import "server-only";
import sharp, { type Metadata } from "sharp";
import { AppError } from "./errors";

export interface ProcessedImage {
  body: Buffer;
  width: number;
  height: number;
  blurDataUrl: string;
  dominantColor: string;
  /** "LIGHT" for packshots on white (drinks, desserts), "DARK" for food shot on the dark set. */
  backdrop: "LIGHT" | "DARK";
}

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Normalises an uploaded product photo exactly like the catalog import: auto-rotated, at most
 * 1000×1500 WebP, tiny blur placeholder, dominant colour and backdrop detection. Metadata such as
 * GPS coordinates is dropped.
 */
export async function processProductPhoto(input: Buffer): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new AppError("BAD_REQUEST", "Il file non è un'immagine valida.");
  }
  if (!meta.width || !meta.height || !["jpeg", "png", "webp", "avif", "heif"].includes(meta.format ?? "")) {
    throw new AppError("BAD_REQUEST", "Formati supportati: JPG, PNG, WebP, AVIF, HEIC.");
  }
  if (meta.width < 400 || meta.height < 400)
    throw new AppError("BAD_REQUEST", "Immagine troppo piccola: almeno 400×400 pixel.");

  const sample = await sharp(input).rotate().resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer();
  let sum = 0;
  let count = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (x > 4 && x < 59 && y > 4 && y < 59) continue;
      const i = (y * 64 + x) * 3;
      sum += (0.2126 * sample[i]! + 0.7152 * sample[i + 1]! + 0.0722 * sample[i + 2]!) / 255;
      count++;
    }
  }
  const { dominant } = await sharp(input).rotate().stats();
  const out = await sharp(input)
    .rotate()
    .resize({ width: 1000, height: 1500, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  const blur = await sharp(input).rotate().resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  return {
    body: out.data,
    width: out.info.width,
    height: out.info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    dominantColor: `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`,
    backdrop: sum / count > 0.62 ? "LIGHT" : "DARK",
  };
}
