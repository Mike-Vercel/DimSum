import { AppError } from "@/server/errors";
import { apiRoute, parseId } from "@/server/http";
import { uploadProductPhoto } from "@/server/services/admin/catalog";

/** Photos are resized in the browser first: serverless request bodies are limited to ~4 MB. */
const MAX_BYTES = 4 * 1024 * 1024;

export const POST = apiRoute<{ id: string }>(
  { auth: "catalog:edit", rateLimit: { name: "photo-upload", limit: 30, windowSeconds: 600, by: "user" } },
  async ({ params, req, viewer }) => {
    const productId = parseId(params.id, "Prodotto");
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024)
      throw new AppError("PAYLOAD_TOO_LARGE", "Foto troppo pesante (massimo 4 MB).");
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const alt = String(form?.get("alt") ?? "").trim();
    if (!(file instanceof File)) throw new AppError("BAD_REQUEST", "Seleziona una foto.");
    if (file.size > MAX_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Foto troppo pesante (massimo 4 MB).");
    if (alt.length < 2 || alt.length > 140)
      throw new AppError("VALIDATION_FAILED", "Descrivi la foto in poche parole (testo alternativo).");
    return uploadProductPhoto(productId, { body: Buffer.from(await file.arrayBuffer()), alt }, viewer!);
  },
);
