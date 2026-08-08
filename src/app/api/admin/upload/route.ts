/**
 * POST /api/admin/upload — guarded admin image upload for the product form
 * (drag-and-drop). OWNER-only. Multipart single field `file`; returns a LOCAL
 * `/uploads/products/<uuid>.<ext>` path. Creates NO DB rows — persisting the
 * product (and revalidating caches) stays the inventory screen's job.
 *
 * Security posture (auth-adjacent surface, security-review skill):
 * - requireAdminOrThrow is the single enforcement point — the middleware only
 *   matches /admin/:path* PAGE routes, never /api/*.
 * - Content-type + client-extension allowlist (jpeg/png/webp only), mismatches
 *   rejected; magic-byte sniff as defense-in-depth (src/lib/uploads.ts).
 * - 2 MB cap: cheap content-length pre-check + authoritative File.size.
 * - Filename = crypto.randomUUID() + MIME-derived extension — zero client
 *   input in paths. Multipart parsed via native request.formData()
 *   (Node runtime) — no busboy dependency.
 * - Internal errors are logged server-side, never leaked to the client.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireAdminOrThrow } from '@/lib/auth/guards';
import { NotAuthorizedError } from '@/lib/errors';
import {
  OUT_EXT_BY_MIME,
  UPLOAD_CONTENT_LENGTH_SLACK,
  UPLOAD_MAX_BYTES,
  allowedMime,
  clientExtMatchesMime,
  sniffMatches,
} from '@/lib/uploads';
import type { UploadResult } from '@/types/api';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'products');
const URL_PREFIX = '/uploads/products';

type UploadErrorCode = 'UPLOAD_FAILED' | 'UPLOAD_TOO_LARGE' | 'UPLOAD_TYPE_REJECTED' | 'UNAUTHORIZED';

function fail(code: UploadErrorCode, message: string, status: number): NextResponse {
  const body: UploadResult = { ok: false, error: { code, message } };
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth — OWNER only, before touching the body.
  let admin;
  try {
    admin = await requireAdminOrThrow();
  } catch (error) {
    if (error instanceof NotAuthorizedError) {
      // Contract fixes this code to UNAUTHORIZED (actions use NOT_AUTHORIZED
      // via toActionResult); preserve the 401 no-session / 403 non-owner status.
      return fail('UNAUTHORIZED', error.message, error.httpStatus);
    }
    console.error('[zubeli] upload auth check failed:', error);
    return fail('UPLOAD_FAILED', 'Something went wrong. Please try again.', 500);
  }

  // 2. Cheap early rejection of oversized bodies before multipart parsing.
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > UPLOAD_MAX_BYTES + UPLOAD_CONTENT_LENGTH_SLACK) {
    return fail('UPLOAD_TOO_LARGE', 'File must be 2 MB or smaller', 413);
  }

  // 3. Multipart parse — native formData(), Node runtime (Next 15).
  let file: File;
  try {
    const form = await request.formData();
    const entry = form.get('file');
    if (!entry || typeof entry === 'string') {
      return fail('UPLOAD_FAILED', 'No file provided in the "file" field', 400);
    }
    file = entry;
  } catch (error) {
    console.error('[zubeli] upload multipart parse failed:', error);
    return fail('UPLOAD_FAILED', 'Could not read the uploaded file', 400);
  }

  // 4. Constraints — size first (authoritative), then type allowlist + match.
  if (file.size === 0) return fail('UPLOAD_FAILED', 'The uploaded file is empty', 400);
  if (file.size > UPLOAD_MAX_BYTES) return fail('UPLOAD_TOO_LARGE', 'File must be 2 MB or smaller', 413);

  const mime = allowedMime(file.type);
  if (!mime) return fail('UPLOAD_TYPE_REJECTED', 'Only JPEG, PNG and WebP images are allowed', 415);
  if (!clientExtMatchesMime(mime, file.name)) {
    return fail('UPLOAD_TYPE_REJECTED', 'File type and extension do not match', 415);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffMatches(mime, bytes)) {
    return fail('UPLOAD_TYPE_REJECTED', 'File contents do not match the declared image type', 415);
  }

  // 5. Persist — random UUID + MIME-derived extension; nothing client-supplied
  //    enters the path. mkdir on demand (contract: at startup or lazily).
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `${randomUUID()}.${OUT_EXT_BY_MIME[mime]}`;
    await writeFile(join(UPLOAD_DIR, fileName), Buffer.from(bytes));
    return NextResponse.json<UploadResult>({ ok: true, data: { url: `${URL_PREFIX}/${fileName}` } });
  } catch (error) {
    console.error(`[zubeli] upload write failed (admin ${admin.id}):`, error);
    return fail('UPLOAD_FAILED', 'Something went wrong. Please try again.', 500);
  }
}
