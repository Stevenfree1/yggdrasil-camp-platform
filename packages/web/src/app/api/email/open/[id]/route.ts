import { prisma } from '@/server/lib/prisma';
import logger from '@/server/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1×1 fully-transparent GIF.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function pixelResponse() {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      // Never cache — every render should reach us so opens keep counting and
      // proxies don't serve a stored copy that hides later opens.
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

/**
 * Email open-tracking pixel. Injected into every outbound HTML email by the
 * email service (see lib/email.ts → injectOpenPixel). Stamps openedAt on first
 * load and increments openCount on every load. Always returns the pixel, even
 * if the id is unknown or the DB write fails — a broken image in someone's
 * inbox would be worse than a missed open.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = params?.id;

  // Basic shape guard so a bad path doesn't hit the DB needlessly.
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    try {
      // Stamp the first-open time only once...
      await prisma.emailLog.updateMany({
        where: { id, openedAt: null },
        data: { openedAt: new Date() },
      });
      // ...but count every open.
      await prisma.emailLog.updateMany({
        where: { id },
        data: { openCount: { increment: 1 } },
      });
    } catch (err: any) {
      logger.error(`Email open-pixel write failed for ${id}: ${err?.message || err}`);
    }
  }

  return pixelResponse();
}
