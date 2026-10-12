# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## What this is

Camp Platform: self-hosted member and operations management for a single
Burning Man theme camp (one install = one camp; no multi-tenancy). It ships
configured as "Camp Dust Devil", a fictional demo camp. `CUSTOMIZING.md` is the
checklist for turning it into a real camp's install.

## Layout

```
config/                     camp identity (camp.config.ts), brand tokens, page copy, member FAQ/resources
packages/database/          Prisma schema, migrations, demo seed (prisma/seed.ts), scripts/create-admin.ts
packages/web/               Next.js 14 App Router app, frontend + tRPC API in one process
  src/app/                  pages; /api/trpc/[trpc] mounts the tRPC router
  src/server/routers/       tRPC routers: auth, members, seasons, seasonMembers, applications, payments,
                            charges, shifts, build, strike, tickets, lodging, inventory, budgets, expenses,
                            communications, emailLog, announcements, events, import, export, invitations, dashboard
  src/server/lib/           email, Stripe/PayPal, master-doc export, Google Sheets, auth helpers
  src/components/lodging/   Konva lodging-map editor (client-only, loaded with dynamic(ssr:false))
```

## Conventions

- **Camp identity comes from `config/camp.config.ts`.** Never hardcode the camp name, domain, email, or URLs in code; use `getCampConfig()` (`@/lib/config`) on the server or `useCampConfig()` in components. Page copy lives in `config/content.config.ts`.
- **Keep the code generic.** Burning Man vocabulary (BRC, playa, DGS, WAP, MOOP, early arrival, strike) belongs in code. One camp's specifics (project names, cultural theme, dues tiers) belong in config or the database.
- **Auth:** httpOnly cookie `camp-session` holding a signed JWT (7-day rolling). The server reads it in `src/server/context.ts`. The client's `AuthContext` wraps `trpc.auth.getProfile`. No localStorage tokens.
- **Roles:** `LEAD` > `MANAGER` > `STAFF` (scoped by `adminScopes`: INVENTORY, SHIFTS) > `MEMBER`. Procedure builders are in `src/server/trpc.ts`.
- **Money is integer cents** everywhere.
- **Date-only fields** (season, build, shift, and strike dates) are stored at **noon UTC** and formatted with the helpers in `src/lib/dates.ts`. Midnight UTC shows up a day early in US timezones.
- **tRPC uses superjson.** A raw `fetch('/api/trpc/...')` must send `{ json: input }` and read `result.data.json`.
- **Lodging map / canvas:** react-konva with `canvas` externalized in `next.config.js`; always import canvas components with `dynamic(..., { ssr: false })`.
- **Images:** use `next/image` for content images. `sharp` is a required dependency; the optimizer is WebP-only on purpose. CSS background images bypass the optimizer, so keep them small.

## Commands

From the repo root:

- `npm run dev`: dev server on http://localhost:3006
- `npm run build`, `npm start` (port 3000)
- `npm run type-check`, `npm run lint`, `npm test` (Jest, in packages/web)
- `npm run db:generate`: regenerate the Prisma client after schema edits
- `npm run db:migrate`: create and apply a migration (dev)
- `npm run db:seed`: wipe and reload the demo camp. **Destructive.** Never run it against a real camp's database.
- `npm run db:create-admin -- --email ... --name ... --password ...`

## Schema changes

Edit `packages/database/prisma/schema.prisma`, run `npm run db:migrate` to
generate a migration, and commit the migration folder. Production applies it with
`prisma migrate deploy` (the Docker image does this on start).
