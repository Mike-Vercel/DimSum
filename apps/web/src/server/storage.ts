import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { AppError } from "./errors";

export interface StoredObject {
  url: string;
  key: string;
}

/**
 * Object storage for uploaded images. Production uses Vercel Blob (the deployment filesystem is
 * read-only and ephemeral); local development writes to public/uploads.
 */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
  const e = env();
  if (e.STORAGE_PROVIDER === "vercel-blob") {
    if (!e.BLOB_READ_WRITE_TOKEN)
      throw new AppError("SERVICE_UNAVAILABLE", "Archivio immagini non configurato (BLOB_READ_WRITE_TOKEN).");
    const { put } = await import("@vercel/blob");
    const blob = await put(key, body, {
      access: "public",
      contentType,
      token: e.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
    });
    return { url: blob.url, key };
  }
  if (e.VERCEL_ENV)
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Su Vercel imposta STORAGE_PROVIDER=vercel-blob per caricare immagini.",
    );
  const file = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return { url: `/uploads/${key}`, key };
}

export async function deleteObject(key: string): Promise<void> {
  const e = env();
  if (e.STORAGE_PROVIDER === "vercel-blob") {
    if (!e.BLOB_READ_WRITE_TOKEN) return;
    const { del } = await import("@vercel/blob");
    await del(key, { token: e.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    return;
  }
  await unlink(path.join(process.cwd(), "public", "uploads", key)).catch(() => undefined);
}
