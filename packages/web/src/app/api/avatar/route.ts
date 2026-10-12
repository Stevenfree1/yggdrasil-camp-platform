import { cookies } from 'next/headers';
import sharp from 'sharp';
import { createContext } from '@/server/context';
import { prisma } from '@/server/lib/prisma';
import { assertRateLimit } from '@/server/lib/rate-limit';
import logger from '@/server/lib/logger';

// sharp is a native module and Prisma returns Node Buffers — must run on Node,
// never the edge runtime. force-dynamic so the session cookie is re-read per req.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Upload / replace the signed-in member's avatar.
 *
 * Identity comes ONLY from the httpOnly `camp-session` cookie via createContext —
 * never from the body/query/params. The write target is `ctx.user.id`, so a
 * member can only ever address their own avatar row (own-avatar-only is
 * structural, not a check).
 */
export async function POST(req: Request) {
  // --- Auth gate (mirrors context.ts: verifyToken + member lookup + isActive) ---
  const ctx = await createContext({ req, cookieStore: cookies() });
  if (!ctx.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  const memberId = ctx.user.id;

  // --- Rate limit (route handler, so map the TRPCError throw to a 429) ---
  try {
    assertRateLimit({
      key: `avatar:${memberId}`,
      limit: 10,
      windowMs: 60_000,
      action: 'avatar upload',
    });
  } catch {
    return new Response('Too many requests', { status: 429 });
  }

  // --- Cheap content-length sanity check before reading the body ---
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    return new Response('File too large', { status: 413 });
  }

  // --- Parse multipart form ---
  // NOTE: cast through unknown to the Web FormData type. The mobile package's
  // @types/react-native leaks a global FormData lacking .get(); the runtime
  // value is the standard Web FormData, so we use its DOM type here.
  let file: File;
  try {
    const form = (await req.formData()) as unknown as {
      get(name: string): unknown;
    };
    const candidate = form.get('file');
    if (!(candidate instanceof File)) {
      return new Response('Missing file', { status: 400 });
    }
    file = candidate;
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  // --- Cheap rejects BEFORE sharp ---
  // Type allowlist (explicitly blocks HEIC/SVG/GIF).
  if (!ALLOWED_TYPES.has(file.type)) {
    return new Response('Unsupported image type', { status: 415 });
  }
  // Size guard from File metadata.
  if (file.size > MAX_BYTES) {
    return new Response('File too large', { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  // Re-check actual byte length after read.
  if (buf.length > MAX_BYTES) {
    return new Response('File too large', { status: 413 });
  }

  // --- Sharp: EXIF-aware rotate, smart center-crop to 512×512 square, WebP ---
  let webp: Buffer;
  try {
    webp = await sharp(buf, { failOn: 'error' })
      .rotate() // honor EXIF orientation so phone photos aren't sideways
      .resize(512, 512, {
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: false,
      })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (err: any) {
    logger.error(`Avatar processing failed for ${memberId}: ${err?.message || err}`);
    return new Response('Could not process image', { status: 400 });
  }

  // --- Persist atomically: upsert avatar row + flip hasAvatar flag ---
  try {
    await prisma.$transaction([
      prisma.memberAvatar.upsert({
        where: { memberId },
        create: { memberId, mimeType: 'image/webp', data: webp },
        update: { mimeType: 'image/webp', data: webp }, // updatedAt auto-bumps
      }),
      prisma.member.update({
        where: { id: memberId },
        data: { hasAvatar: true },
      }),
    ]);
  } catch (err: any) {
    logger.error(`Avatar save failed for ${memberId}: ${err?.message || err}`);
    return new Response('Could not save image', { status: 500 });
  }

  // Return a fresh updatedAt (ms) so the client can cache-bust the GET URL.
  return Response.json({ ok: true, updatedAt: Date.now() });
}

/**
 * Remove the signed-in member's avatar. Own-avatar-only (memberId from session).
 * Idempotent: deleteMany is a no-op if the row is already gone.
 */
export async function DELETE(req: Request) {
  const ctx = await createContext({ req, cookieStore: cookies() });
  if (!ctx.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  const memberId = ctx.user.id;

  try {
    await prisma.$transaction([
      // deleteMany (not delete) so removing a non-existent avatar is a safe no-op.
      prisma.memberAvatar.deleteMany({ where: { memberId } }),
      prisma.member.update({
        where: { id: memberId },
        data: { hasAvatar: false },
      }),
    ]);
  } catch (err: any) {
    logger.error(`Avatar delete failed for ${memberId}: ${err?.message || err}`);
    return new Response('Could not remove image', { status: 500 });
  }

  return Response.json({ ok: true });
}
