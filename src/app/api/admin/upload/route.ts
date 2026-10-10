/**
 * POST /api/admin/upload — guarded admin image upload for the product form
 * (drag-and-drop). OWNER-only. Multipart single field `file`; returns the URL
 * of the stored image (Vercel Blob in production, a local
 * `/uploads/products/<uuid>.<ext>` path in dev — see src/lib/uploads-store.ts).
 * Creates NO DB rows — persisting the product (and revalidating caches) stays
 * the inventory screen's job.
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
import { putProductImage } from '@/lib/uploads-store';
import type { UploadResult } from '@/types/api';

type UploadErrorCode = 'UPLOAD_FAILED' | 'UPLOAD_TOO_LARGE' | 'UPLOAD_TYPE_REJECTED' | 'UNAUTHORIZED';

function fail(code: UploadErrorCode, message: string, status: number): NextResponse {
  const body: UploadResult = { ok: false, error: { code, message } };
  return NextResponse.json(body, { status });
}

/**
 * Caps an unmeasured request body (no content-length → chunked transfer) at the
 * upload limit + multipart slack. The TransformStream errors the moment the
 * running total crosses the cap, so `formData()` aborts mid-stream instead of
 * buffering an unbounded body first.
 */
function capBodyStream(body: ReadableStream<Uint8Array>, onExceeded: () => void): ReadableStream<Uint8Array> {
  const cap = UPLOAD_MAX_BYTES + UPLOAD_CONTENT_LENGTH_SLACK;
  let total = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > cap) {
          onExceeded();
          controller.error(new Error('UPLOAD_BODY_TOO_LARGE'));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
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
  //    `content-length` is absent on chunked-transfer uploads — the case the
  //    perf review flagged (formData() would otherwise buffer the whole body).
  //    A declared length is checked here; an undeclared one is capped on the
  //    stream in step 3. Residual: a client that declares a LYING (small)
  //    content-length can still stream past this pre-check — the authoritative
  //    `file.size` check below is the backstop for that case.
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = Number(contentLengthHeader ?? '0');
  if (contentLengthHeader !== null && contentLength > UPLOAD_MAX_BYTES + UPLOAD_CONTENT_LENGTH_SLACK) {
    return fail('UPLOAD_TOO_LARGE', 'File must be 2 MB or smaller', 413);
  }

  // 3. Multipart parse — native formData(), Node runtime (Next 15). With no
  //    declared length, parse a Request built over a byte-capped stream so an
  //    oversized (or endless) chunked body is cut off before it is buffered.
  let bodyExceededCap = false;
  let file: File;
  try {
    const body = request.body;
    if (!body) return fail('UPLOAD_FAILED', 'No file provided in the "file" field', 400);

    const parseable =
      contentLengthHeader === null
        ? new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: capBodyStream(body, () => {
              bodyExceededCap = true;
            }),
            duplex: 'half',
          } as RequestInit & { duplex: 'half' })
        : request;

    const form = await parseable.formData();
    const entry = form.get('file');
    if (!entry || typeof entry === 'string') {
      return fail('UPLOAD_FAILED', 'No file provided in the "file" field', 400);
    }
    file = entry;
  } catch (error) {
    if (bodyExceededCap) return fail('UPLOAD_TOO_LARGE', 'File must be 2 MB or smaller', 413);
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
  //    enters the path. Storage backend (Blob in prod, local fs in dev) is
  //    uploads-store.ts's business; mkdir on demand (contract: at startup or
  //    lazily).
  try {
    const stored = await putProductImage(bytes, OUT_EXT_BY_MIME[mime]);
    return NextResponse.json<UploadResult>({ ok: true, data: { url: stored.url } });
  } catch (error) {
    console.error(`[zubeli] upload write failed (admin ${admin.id}):`, error);
    return fail('UPLOAD_FAILED', 'Something went wrong. Please try again.', 500);
  }
}
