import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { buildMasterDocument } from '@/server/lib/master-doc';
import { syncSheetsToGoogle } from '@/server/lib/google-sheets';
import logger from '@/server/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

function isAuthorized(req: Request) {
  const secret = process.env.BACKUP_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
  const headerSecret = req.headers.get('x-cron-secret');

  return bearer === secret || headerSecret === secret;
}

async function handleBackup(req: Request) {
  const configuredSecret = process.env.BACKUP_CRON_SECRET || process.env.CRON_SECRET;
  if (!configuredSecret) {
    return json({ error: 'Backup cron secret is not configured' }, 503);
  }

  if (!isAuthorized(req)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, year: true },
  });

  if (!activeSeason) {
    return json({ error: 'No active season found' }, 404);
  }

  try {
    const data = await buildMasterDocument(prisma, activeSeason.id);
    const result = await syncSheetsToGoogle(data.sheets);

    logger.info(
      `Google Sheets backup synced for ${activeSeason.name}: ${data.memberCount} members, ${data.paymentCount} payments`,
    );

    return json({
      success: true,
      season: activeSeason,
      spreadsheetUrl: result.spreadsheetUrl,
      memberCount: data.memberCount,
      paymentCount: data.paymentCount,
      syncedSheets: result.updatedSheets,
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Google Sheets backup failed for ${activeSeason.name}: ${message}`);
    return json({ error: 'Backup sync failed', message }, 500);
  }
}

export async function GET(req: Request) {
  return handleBackup(req);
}

export async function POST(req: Request) {
  return handleBackup(req);
}
