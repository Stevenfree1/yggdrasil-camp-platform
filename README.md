# Camp Platform

Self-hostable member and operations management for a Burning Man theme camp.
It keeps one roster and builds everything else on it: applications, dues,
shifts, build and strike crews, tickets, lodging map, inventory, budget, and
camp email.

It ships configured as **Camp Dust Devil**, a fictional 20-person demo camp,
so every screen has data on first run. [CUSTOMIZING.md](CUSTOMIZING.md)
walks you through making it yours.

## What's in it

**Public / applicant**
- Landing page, `/apply` application form, register, login, password reset, invite links

**Member portal** (`/portal`, `/members`)
- Dashboard with burn countdown, dues status, and your shifts
- Pay dues and add-ons online by card (Stripe) or PayPal
- Shift signup, profile (travel, housing, power, dietary, emergency contact), and your spot on the lodging map
- Announcements, member directory, FAQ, and resources

**Admin** (`/admin`, role-gated)
- **Roster / Members:** everyone across all seasons, plus per-season status, housing, grid power, travel, and first-timer flags
- **Applications:** a review pipeline from submitted through pre-approved, approved, invited, dues paid and confirmed, with email at each step
- **Season:** dues amount, grid fees, dates, capacity, and the minimum number of shifts per member
- **Payments and charges:** record payments by any method, assign charges, reconcile Stripe and PayPal
- **Shifts:** recurring shift blocks and slots, plus claim and assignment tracking
- **Build and strike:** build days, crew assignments, early-arrival passes, strike crew
- **Tickets:** Directed Group Sale (DGS) tracking, vehicle passes, waitlist
- **Lodging map:** drag-and-drop camp layout with real item footprints, BRC orientation, power-grid coloring, and export
- **Inventory:** gear catalog with storage locations, plus member gear requests
- **Budget and expenses:** budget lines vs. actuals, reimbursements
- **Communications:** mass email with merge fields, templates, email log with open tracking
- **Import / export:** Excel "Master Document" round-trip and an optional nightly Google Sheets backup

**Roles:** `LEAD` (everything), `MANAGER` (admin), `STAFF` (scoped to inventory and/or shifts), `MEMBER`.

## Stack

Next.js 14 (App Router) with tRPC in the same process, Prisma + PostgreSQL,
Tailwind, Framer Motion, and Konva for the map. Auth is an httpOnly signed
cookie session. It's an npm-workspaces monorepo:

```
config/              camp identity, brand, copy, FAQ, resources   <- you edit these
packages/database/   Prisma schema, migrations, demo seed, create-admin script
packages/web/        the Next.js app (pages, components, tRPC routers in src/server)
```

## Quick start (local)

Requirements: Node 20+, PostgreSQL 15+ (Docker is easiest).

```bash
npm install

# 1. Database
docker compose up -d postgres          # or point DATABASE_URL at any Postgres
cp packages/database/.env.example packages/database/.env
cp packages/web/.env.example packages/web/.env
#    then set JWT_SECRET in packages/web/.env  (openssl rand -hex 32)

npm run db:generate
npm run db:migrate                     # creates the tables
npm run db:seed                        # loads the demo camp

# 2. App
npm run dev                            # http://localhost:3006
```

Demo logins (password `campdemo123`):

| Email | Role |
|---|---|
| admin@example.com | LEAD, full admin |
| manager@example.com | MANAGER |
| member@example.com | regular member |

Email, payments, and Google Sheets are all optional. Without an email
provider, emails are written to the server log and the `EmailLog` table
instead of being sent. Without Stripe or PayPal keys, online checkout won't
work, but admins can still record Venmo, Zelle, cash, and other payments by
hand.

## Going live

1. **Customize** following [CUSTOMIZING.md](CUSTOMIZING.md).
2. **Provision Postgres** (Neon, Supabase, Railway, RDS, or a container).
3. **Set env vars.** See `packages/web/.env.example` for the full list. At minimum: `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL`.
4. **Deploy.** Either:
   - **Docker:** `docker build -f packages/web/Dockerfile -t camp .` The container runs `prisma migrate deploy` on start and serves on port 3000.
   - **Any Node host:** `npm ci && npm run db:generate && npm run build`, then `npx prisma migrate deploy --schema packages/database/prisma/schema.prisma` and `npm start`.
5. **Create your first admin** (don't load the demo seed in production):
   ```bash
   npm run db:create-admin -- --email you@yourcamp.org --name "Your Name" --password 'a-long-password'
   ```
6. **Set up integrations** as needed:
   - **Email:** SendGrid (`SENDGRID_API_KEY`) or any SMTP server (`SMTP_*`).
   - **Stripe:** `STRIPE_SECRET_KEY`, plus a webhook pointed at `/api/stripe/webhook` with its secret in `STRIPE_WEBHOOK_SECRET`.
   - **PayPal:** `PAYPAL_*`, plus a webhook at `/api/paypal/webhook`.
   - **Google Sheets backup:** a service account, then call `/api/cron/backup-google-sheet` daily from any cron service with `BACKUP_CRON_SECRET`.

### Images and hosting notes

- Content images use `next/image`; the optimizer needs `sharp` (already a dependency) and serves WebP.
- The optimizer caches in `.next/cache/images`. On container hosts, mount a persistent volume at `/app/packages/web/.next/cache` or images re-encode after every deploy.
- Images used as CSS backgrounds (`/images/texture.webp`, `/images/pattern.webp`) aren't optimized. Keep them small.

## Scripts

From the repo root:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3006 |
| `npm run build` / `npm start` | Production build / serve on :3000 |
| `npm run type-check` / `npm run lint` / `npm test` | Checks |
| `npm run db:migrate` | Create and apply a migration after editing `schema.prisma` |
| `npm run db:seed` | Wipe and reload the demo camp (**destructive**) |
| `npm run db:create-admin -- ...` | Create or promote a LEAD admin |
| `npm run db:studio` | Browse the database |

## License

MIT. See [LICENSE](LICENSE).
