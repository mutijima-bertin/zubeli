/**
 * Admin image-upload validation — pure helpers for POST /api/admin/upload
 * (no fs, no request scope, so the constraints are unit-testable).
 *
 * MVP posture: content-type + client-extension checks are the primary gate
 * (contract requirement); magic-byte sniffing is cheap defense-in-depth — a
 * renamed SVG would otherwise clear both client-supplied checks. Serving is
 * already safe (public/ assets are served with a content-type derived from the
 * on-disk extension), but we reject such files early anyway.
 */
import 'server-only';

export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024; // 2 MB — authoritative check is File.size
/** Slack for multipart framing in the cheap content-length pre-check. */
export const UPLOAD_CONTENT_LENGTH_SLACK = 64 * 1024;

export type UploadMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Client extensions accepted per MIME (input) + the safe on-disk extension (output). */
const ALLOWED: Record<UploadMime, { exts: readonly string[]; outExt: string }> = {
  'image/jpeg': { exts: ['jpg', 'jpeg'], outExt: 'jpg' },
  'image/png': { exts: ['png'], outExt: 'png' },
  'image/webp': { exts: ['webp'], outExt: 'webp' },
};

/** Safe on-disk extension derived from the detected MIME — never from the client. */
export const OUT_EXT_BY_MIME = Object.fromEntries(
  Object.entries(ALLOWED).map(([mime, { outExt }]) => [mime, outExt]),
) as Record<UploadMime, string>;

export function allowedMime(mime: string): UploadMime | null {
  return mime in ALLOWED ? (mime as UploadMime) : null;
}

/** Lowercased extension of the client filename — strips any path/separator first. */
export function clientExtensionOf(fileName: string): string | null {
  if (!fileName) return null;
  const base = fileName.replace(/\\/g, '/').slice(fileName.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  return base.slice(dot + 1).toLowerCase();
}

/** The client-supplied extension must be in the allowlist for the declared MIME. */
export function clientExtMatchesMime(mime: UploadMime, fileName: string): boolean {
  const ext = clientExtensionOf(fileName);
  return ext !== null && (ALLOWED[mime].exts as readonly string[]).includes(ext);
}

/** Magic-byte signatures — defense-in-depth on top of MIME + extension checks. */
const SIGNATURES: Record<UploadMime, (b: Uint8Array) => boolean> = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  'image/webp': (b) =>
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

export function sniffMatches(mime: UploadMime, bytes: Uint8Array): boolean {
  return SIGNATURES[mime](bytes);
}
