import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { appRouter } from '@/server/routers';
import { createContext } from '@/server/context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ req, cookieStore: cookies() }),
    onError({ error, path }) {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`[tRPC] ${path}:`, error);
      }
    },
  });
}

export { handler as GET, handler as POST };
