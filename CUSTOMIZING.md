# Making it your camp

The repo ships as **Camp Dust Devil**, a fictional camp. Work through this
list top to bottom; most of it is editing files in `config/`. Detailed notes
on each config file are in [config/README.md](config/README.md).

## 1. Identity (15 minutes)

`config/camp.config.ts` is the one place your camp's name lives. Emails,
payment descriptions, page titles, exports, the FAQ, and the map all read
from it.

- `name`, `shortName`, `memberNoun` (what you call members), `tagline`, `description`, `foundingYear`
- `legalName`, plus `taxStatus` / `ein` **only** if you're a registered nonprofit. Leave them `undefined` otherwise; tax-deductible wording in receipts and the footer turns off automatically.
- `email`, `domain`, `location`, `social`
- `brcPlacement`: your Black Rock City address (e.g. `{ clock: '7:30', street: 'D' }`), drawn on the lodging-map compass. Update it each year once placement comes out.

## 2. Words

- `config/content.config.ts`: landing page, `/apply` copy, `/members` intro, nav, and footer.
- `config/member-faq.config.ts`: the member FAQ (dues, early arrival, shifts, what to bring, MOOP, power). It's a sensible generic starting point; make it match how your camp actually runs.
- `config/member-resources.config.ts`: links for `/members/resources`. Mark up to two as `featured: true` to show them on the portal dashboard.
- Email copy: `packages/web/src/server/lib/email.ts` (transactional emails) and `packages/web/src/server/lib/massEmailTemplates.ts` (admin bulk-email templates).

## 3. Look

- **Colors and fonts:** `config/brand.config.ts`. Tailwind tokens are in `packages/web/tailwind.config.js`, shared tokens are in `packages/web/src/styles/globals.css`, and the public poster styling is in `packages/web/src/styles/public-site.css`. Font imports live in `packages/web/src/app/layout.tsx`.
- **Images:** every image is a placeholder illustration. Replace them, keeping the file names:

| File (under `packages/web/public/`) | Where it shows |
|---|---|
| `images/hero.webp` | Landing hero and link-preview image |
| `images/camp-day.webp`, `images/lounge.webp`, `images/build-crew.webp` | Landing "what we do" cards |
| `images/camp-night.webp` | Landing closing banner |
| `images/portal-group.webp` | Member portal header |
| `images/texture.webp`, `images/pattern.webp` | Subtle page backgrounds (keep these small) |
| `images/compass-plate.webp` | Lodging-map compass medallion |
| `images/brand/wind-mark.svg` | Public nav, footer, and login mark (configured in `brand.config.ts`) |
| `images/brand/logo-*.webp/png` | Original illustrated marks used in admin |
| `images/brand/app-icon-*.png` | Home-screen / PWA icons |
| `wallpapers/camp-day.jpg`, `wallpapers/camp-night.jpg` | Downloadable phone wallpapers on the portal travel card |

Also replace `packages/web/src/app/icon.png` (favicon) and `src/app/apple-icon.png`.

Keep photos around 2048px on the long edge, as WebP or JPEG.

## 4. Your season (in the app, not code)

Log in as an admin and set up the season under **Admin → Season**: year,
dues amount, grid-power fees, burn/build/strike dates, capacity, and the
minimum shifts per member. Then:

- **Shifts:** create shift blocks and slots (the demo has coffee-bar and lounge shifts).
- **Build:** add build days.
- **Lodging:** draw your plot and infrastructure on the map.
- **Inventory:** enter your gear and storage locations.

## 5. Start clean

The demo seed creates fake people. For your real database:

1. Point `DATABASE_URL` at an empty database.
2. Run `npx prisma migrate deploy --schema packages/database/prisma/schema.prisma`.
3. **Don't** run `db:seed`.
4. Run `npm run db:create-admin -- --email you@yourcamp.org --name "You" --password '...'`.
5. Bring in your roster with **Admin → Import**, from an Excel file with a "Members" sheet. Export first to get the column layout.

You can delete `packages/database/prisma/seed.ts` once you no longer want the demo.

## 6. Optional deeper changes

- **Lodging-map item catalog** (tents, RVs, containers, shade, power drops, with real footprints): `packages/web/src/components/lodging/catalog.ts`.
- **Application form questions:** `packages/web/src/app/apply/page.tsx` plus the `applications` router and the `Application` model.
- **Data model:** `packages/database/prisma/schema.prisma`, then run `npm run db:migrate`.

## Doing this with Claude Code

The repo includes a `CLAUDE.md`, so Claude Code knows the layout and
conventions. A good first prompt:

> Read CUSTOMIZING.md and config/README.md. Our camp is **[name]**, a
> **[what you're about]** camp of about **[N]** people. Our contact email is
> **[email]**, our site will be **[url]**, and we **[are / are not]** a
> 501(c)(3). Our BRC address this year is **[clock & street]**. Rewrite
> everything in `config/` for our camp in a **[tone]** voice. Here's how we
> run dues, shifts, and build: **[paste notes]**. Then run type-check and
> tests, and show me what you changed.
