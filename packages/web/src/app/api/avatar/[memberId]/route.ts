import { cookies } from 'next/headers';
import { createContext } from '@/server/context';
import { prisma } from '@/server/lib/prisma';
import logger from '@/server/lib/logger';

// Prisma Bytes come back as a Node Buffer — must run on Node, never the edge.
// force-dynamic so the session cookie is re-read per request (route is gated).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Browser-only cache. NOT public/immutable: this route is session-gated, so a
// shared/proxy cache must never store one member's face and serve it to another
// session. The profile surface appends ?v=<updatedAt-ms> (cache-bust on edit);
// the directory/roster/admin-members surfaces hit the un-busted URL, so after a
// photo change or removal they may show a stale avatar for up to max-age.
const CACHE_CONTROL = 'private, max-age=300, must-revalidate';

/**
 * Serve a member's avatar WebP. Session-gated: any authenticated active member
 * may view any member's avatar (same visibility the member directory already
 * grants member-to-member). Returns 404 when absent so the client falls back to
 * initials. A broken avatar must never 500 the directory grid.
 */
export async function GET(
  req: Request,
  { params }: { params: { memberId: string } },
) {
  // Shape guard before touching the DB.
  const memberId = params?.memberId;
  if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) {
    return new Response(null, { status: 404 });
  }

  // Privacy gate: only authenticated active members may read avatars.
  const ctx = await createContext({ req, cookieStore: cookies() });
  if (!ctx.user) {
    return new Response(null, { status: 401 });
  }

  let avatar: { data: Buffer; mimeType: string; updatedAt: Date } | null;
  try {
    avatar = (await prisma.memberAvatar.findUnique({
      where: { memberId },
      select: { data: true, mimeType: true, updatedAt: true },
    })) as { data: Buffer; mimeType: string; updatedAt: Date } | null;
  } catch (err: any) {
    logger.error(`Avatar fetch failed for ${memberId}: ${err?.message || err}`);
    return new Response(null, { status: 404 });
  }

  if (!avatar) {
    return new Response(null, { status: 404 });
  }

  const etag = '"' + avatar.updatedAt.getTime().toString(36) + '"';

  // Cheap revalidation: if the client's ETag still matches, send 304.
  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': CACHE_CONTROL },
    });
  }

  // Pass a Uint8Array view (valid BodyInit) rather than the raw Node Buffer.
  const body = new Uint8Array(avatar.data);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': avatar.mimeType, // always image/webp
      'Content-Length': String(body.length),
      ETag: etag,
      'Cache-Control': CACHE_CONTROL,
    },
  });
}
