/** "8,90" → 890. Returns null for anything that is not a non-negative amount with ≤ 2 decimals. */
export function parseEuroToCents(text: string): number | null {
  const normalized = text.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** 890 → "8,90" for editable inputs. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Field errors from an ApiError (`{ "variants.0.priceCents": [...] }`) as first message per field. */
export function firstErrors(fieldErrors: Record<string, string[]> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""]));
}

/** Downscales a photo in the browser before upload (serverless bodies are limited to ~4 MB). */
export async function resizeForUpload(file: File, maxSide = 2000, quality = 0.9): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 3.5 * 1024 * 1024 && file.type === "image/jpeg") {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), "image/jpeg", quality),
  );
}
