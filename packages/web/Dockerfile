# Multi-stage build for the Camp Platform web app (Next.js + tRPC) in this
# npm-workspaces monorepo.
#
# Build from the REPO ROOT so the workspace, the database package, and the
# top-level config/ directory are all in the build context:
#
#   docker build -f packages/web/Dockerfile -t camp-platform .
#   docker run -p 3000:3000 --env-file packages/web/.env camp-platform
#
# On start the container applies pending Prisma migrations, then runs
# `next start`. DATABASE_URL and JWT_SECRET must be provided at runtime.

# --- Base ---
FROM node:20-alpine AS base
# Prisma's query engine needs OpenSSL; libc6-compat helps native modules (sharp).
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
# Manifests only, so this layer is cached until dependencies change.
COPY package.json package-lock.json ./
COPY packages/web/package.json ./packages/web/
COPY packages/database/package.json ./packages/database/
# The web package's postinstall runs `prisma generate`, which needs the schema.
COPY packages/database/prisma ./packages/database/prisma
RUN npm ci

# --- Builder ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@camp-platform/web

# --- Runner ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The app is run with `next start` (no standalone output), so it needs the
# built workspace plus node_modules (including the Prisma CLI for migrations).
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app ./
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy --schema packages/database/prisma/schema.prisma && npm run start --workspace=@camp-platform/web"]
