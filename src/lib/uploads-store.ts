/**
 * Product-image storage seam (server-only). One interface, two backends:
 *
 * - PRODUCTION (Vercel): `BLOB_READ_WRITE_TOKEN` present → the bytes go to
 *   Vercel Blob (`products/<uuid>.<ext>`, `access: 'public'`) and we return the
 *   absolute public URL. Serverless filesystems are READ-ONLY apart from /tmp,
 *   so writing into `public/` would throw at runtime.
 * - LOCAL DEV / CI / e2e: token absent → write to
 *   `public/uploads/products/<uuid>.<ext>` exactly as the pre-serverless route
 *   did (`mkdir -p` + `writeFile`, UUID name, `/uploads/products/...` URL), so
 *   the dev server, the Playwright harness and CI keep working untouched.
 *
 * The caller (POST /api/admin/upload) validates bytes and extension BEFORE
 * calling in — `ext` here is always the MIME-derived, allowlisted extension
 * from `OUT_EXT_BY_MIME`, never a client-supplied string.
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type StoredImage = { url: string };

/** Local dev fallback — byte-for-byte the pre-serverless on-disk layout. */
const LOCAL_DIR = join(process.cwd(), 'public', 'uploads', 'products');
const LOCAL_URL_PREFIX = '/uploads/products';

/** Vercel Blob folder (root-relative pathname prefix). */
const BLOB_FOLDER = 'products';

/** Serve the right content type for the MIME-derived extension. */
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? token : null;
}

/**
 * Stores one product image and returns the URL to persist on the product.
 * Throws on failure (the route maps that to 500) — storage is not fail-soft,
 * a lost upload must be visible to the owner rather than silently dropped.
 */
export async function putProductImage(bytes: Uint8Array, ext: string): Promise<StoredImage> {
  const token = blobToken();

  if (token) {
    const { put } = await import('@vercel/blob');
    const { url } = await put(`${BLOB_FOLDER}/${randomUUID()}.${ext}`, Buffer.from(bytes), {
      access: 'public',
      token,
      addRandomSuffix: false, // the UUID already makes the pathname unique
      contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream',
    });
    return { url };
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  const fileName = `${randomUUID()}.${ext}`;
  await writeFile(join(LOCAL_DIR, fileName), Buffer.from(bytes));
  return { url: `${LOCAL_URL_PREFIX}/${fileName}` };
}

/**
 * Best-effort removal of a previously stored product image. Fail-soft by
 * contract: a delete failure must never break a product save (a stale image is
 * harmless, a failed product update is not). Nothing currently calls this —
 * it exists as the interface seam for when product deletion lands.
 *
 * Local `/uploads/...` paths are a no-op (the dev tree is gitignored and the
 * file is disposable). Absolute Vercel Blob URLs are deleted by pathname.
 */
export async function deleteProductImage(url: string): Promise<void> {
  try {
    if (!url || url.startsWith('/')) return; // local dev path — nothing to do

    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return; // not a URL we can resolve to a blob pathname
    }
    if (!pathname || pathname === '/') return;

    const token = blobToken();
    if (!token) return; // no token → there is no blob store to delete from

    const { del } = await import('@vercel/blob');
    await del(pathname, { token });
  } catch (error) {
    console.warn('[zubeli] deleteProductImage failed (ignored):', error);
  }
}