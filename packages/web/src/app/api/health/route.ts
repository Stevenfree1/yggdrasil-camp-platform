import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_PAYMENT_COLUMNS = [
  'processor',
  'processorCheckoutSessionId',
  'processorPaymentIntentId',
  'processorPaymentMethodType',
  'processorCustomerId',
  'feeAmount',
  'netAmount',
];

function healthResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const [activeSeason, paymentColumns] = await Promise.all([
      prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true, name: true, year: true },
      }),
      prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments'
      `,
    ]);

    const columnSet = new Set(paymentColumns.map((column) => column.column_name));
    const missingPaymentColumns = REQUIRED_PAYMENT_COLUMNS.filter((column) => !columnSet.has(column));
    const ok = missingPaymentColumns.length === 0;

    return healthResponse({
      status: ok ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      database: 'ok',
      runtimeSchema: {
        payments: {
          ok,
          missingColumns: missingPaymentColumns,
        },
      },
      activeSeason: activeSeason
        ? { id: activeSeason.id, name: activeSeason.name, year: activeSeason.year }
        : null,
      deployment: {
        branch: process.env.DEPLOY_BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF ?? null,
        resource: process.env.DEPLOY_RESOURCE_ID ?? null,
      },
    }, ok ? 200 : 503);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown health check failure';

    return healthResponse({
      status: 'down',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      database: 'error',
      error: message,
    }, 503);
  }
}
