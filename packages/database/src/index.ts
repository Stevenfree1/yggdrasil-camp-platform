/**
 * @camp-platform/database
 *
 * Shared database client and utilities for Camp Platform.
 * Import this module from any package that needs database access:
 *
 *   import { prisma } from '@camp-platform/database';
 *
 * In development, the client is cached on the global object to prevent
 * exhausting database connections during hot-reloading.
 */

import { PrismaClient } from '@prisma/client';

// Extend the global type so TypeScript doesn't complain about our cache key
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Create a PrismaClient instance with sensible defaults.
 * Logs queries in development for easier debugging.
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

  return client;
}

/**
 * Singleton PrismaClient instance.
 *
 * In development, we store the client on `globalThis` so that hot-reloading
 * (e.g. Next.js fast refresh, tsx watch) does not create a new connection
 * pool on every reload.
 *
 * In production, a simple module-level singleton is sufficient.
 */
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

/**
 * Gracefully disconnect the Prisma client.
 * Call this during server shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Check database connectivity by running a simple query.
 * Returns true if the database is reachable, false otherwise.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Re-export Prisma namespace types so consumers don't need a direct
// dependency on @prisma/client for type-only imports.
export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';

export default prisma;
