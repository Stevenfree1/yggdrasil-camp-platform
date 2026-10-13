# Camp configuration

Everything that makes this app *your* camp lives in this folder. The web app
reads these files at build time; there is no camp-specific copy anywhere else
in the codebase. The values that ship with the repo describe a fictional demo
camp, **Camp Dust Devil**. Replace them with your own.

| File | What it controls |
| --- | --- |
| `camp.config.ts` | Camp identity: name, short name, what you call members, tagline, description, legal name and tax status, contact email, location, site URL, social links, feature toggles |
| `content.config.ts` | Every sentence on the landing page, the `/members` page, the `/apply` form, the public nav, and the footer |
| `brand.config.ts` | Palette, fonts, and logo/OG image paths |
| `member-faq.config.ts` | The FAQ shown to logged-in members at `/members/faq` |
| `member-resources.config.ts` | The links and documents shown at `/members/resources` (and the `featured` ones on the portal dashboard) |
| `types.ts` | TypeScript types for all of the above. Edit only when adding a new field. |
| `index.ts` | Re-exports, so code can `import { campConfig } from 'config'`-style paths |

## Quick start

1. **`camp.config.ts`**: set `name`, `shortName`, `memberNoun`, `tagline`,
   `description`, `email`, `location`, and `domain`. Set `taxStatus` (for
   example `'501(c)(3)'`) and `ein` only if your camp is a registered nonprofit;
   leave them `undefined` otherwise and the footer and structured data adapt.
   `website` falls back to `APP_URL` from the environment.
2. **Images**: replace the files in `packages/web/public/images/` keeping the
   same names, or point `content.config.ts` at new paths (see below).
3. **`content.config.ts`**: rewrite the hero, "what we do" cards, joining
   steps, closing call to action, and the apply-form copy in your camp's voice.
4. **`member-faq.config.ts` and `member-resources.config.ts`**: adjust dues,
   shift counts, what the camp provides, and links.
5. Restart `npm run dev` and check `/`, `/apply`, and `/members/faq`.

Copy that states a fact about the camp (its name, email, member noun) is pulled
from `camp.config.ts` with template strings, so changing it once updates the
landing page, the FAQ, page titles, emails, and JSON-LD together.

## `camp.config.ts`

- `name` / `shortName`: full and short forms. `shortName` is used in tight UI
  spots (the member nav "back" link) and email subjects.
- `memberNoun`: what you call members, e.g. `{ singular: 'camper', plural: 'campers' }`.
  Used in the FAQ, the apply form, and member-area copy.
- `foundingYear`: optional. When set it appears under the camp name in the nav
  ("Burning Man theme camp, est. 2018") and in the organization JSON-LD.
- `features`: toggles for optional areas. The current app only uses
  `membership`; the rest are reserved for future modules.

## `content.config.ts`

| Section | Where it shows |
| --- | --- |
| `hero` | Landing page hero with a rust title panel and a camp image (loaded with `priority`). |
| `hero.titleLines` | Optional two-part title: a small prefix and large display name. Falls back to `hero.title` when omitted. |
| `home.fieldNotes` | Short camp mottos on the yellow strip below the hero. |
| `home.about` | "What we do" section: three image cards. |
| `home.joining` | "How joining works" strip: apply, get approved, pay dues, sign up for shifts. |
| `home.closing` | Closing call-to-action band over a night photo. |
| `navigation` | Public top nav links and the small line under the camp name. Login/Portal/Admin buttons are added automatically based on the session. |
| `footer` | Footer tagline and link columns. `nonprofitBlurb` shows only when `taxStatus` is set. |
| `members` | `/members` intro, highlights, and login-card labels. |
| `apply` | `/apply` intro, membership requirements, contribution prompt, strike note, and success message. |

Icons are lucide icon names (`coffee`, `hammer`, `calendar`, ...) registered in
`packages/web/src/lib/icons.ts`. Unknown names fall back to a star; add new
ones to the `iconMap` there.

### Images

The landing page expects these files in `packages/web/public/images/`:

| File | Used for |
| --- | --- |
| `hero.webp` | Landing hero background and default Open Graph image |
| `camp-day.webp`, `lounge.webp`, `build-crew.webp` | "What we do" cards |
| `camp-night.webp` | Closing CTA band |
| `texture.webp`, `pattern.webp` | Background textures used by `globals.css` |
| `brand/wind-mark.svg` | Public nav, footer, and login mark, selected by `brand.config.ts` → `assets.logo` |
| `brand/logo-256.webp`, `brand/logo-512.webp` | Original illustrated marks, still used in the admin area |
| `brand/logo-light-512.png`, `brand/logo-dark-512.png` | Logo variants for light/dark backgrounds |
| `brand/app-icon-192.png`, `brand/app-icon-512.png`, `brand/app-icon-maskable-512.png` | PWA manifest icons |

Also replace `packages/web/src/app/icon.png` (favicon) and
`packages/web/src/app/apple-icon.png`.

Keep photos at or under about 2048px on the long edge, as WebP or JPEG. Images
rendered with `next/image` are resized by the optimizer, but CSS backgrounds
(`texture.webp`, `pattern.webp`) are served as-is, so compress those by hand.

## `brand.config.ts`

Dust Devil uses rust, sun yellow, paper, and charcoal, with Barlow Condensed
headings and Space Grotesk body text. Public layout and button treatments live
in `packages/web/src/styles/public-site.css`; update its fixed brand colors too
when changing the palette. Legacy `gold` and `sage` tokens are compatibility
aliases for the new accents.

`colors` and `theme.colors` describe the palette; `fonts` names the display
and body families; `assets` holds logo and Open Graph paths used by metadata.

The tokens the UI actually paints with are CSS variables in
`packages/web/src/styles/globals.css` (`--color-cream`, `--color-ink`,
`--color-gold`, `--color-sage`, ...) and the matching Tailwind colors in
`packages/web/tailwind.config.js`. When you change the palette, update all
three so they stay in sync. Fonts are loaded with `next/font/google` in
`packages/web/src/app/layout.tsx`; change the imports there if you switch
families.

## `member-faq.config.ts`

A list of categories, each with an `id`, `title`, `icon`, and `items` of
`{ q, a }`. The FAQ page is searchable and groups by category. The default set
covers dues, tickets and DGS, early arrival (WAP), build/shifts/strike, what to
bring, housing, power, MOOP, health and safety, and contact. Rewrite the
answers to match how your camp actually runs.

Icon keys for categories are mapped in `packages/web/src/app/members/faq/page.tsx`.

## `member-resources.config.ts`

A list of `{ id, title, description, category, url, updatedAt, icon, featured? }`.

- `category` is one of `guide`, `form`, `document`, `link`.
- `url: '#'` renders an informational card with no link (for "ask a lead" items).
- `featured: true` also shows the resource as a quick link on the portal dashboard.
- Bump `updatedAt` (YYYY-MM-DD) whenever the linked document changes.

## Troubleshooting

- **Type errors after editing**: run `npm run type-check` in `packages/web`.
  Every config object is typed against `types.ts`, so a missing or misspelled
  field shows up there.
- **Icon not showing**: check the spelling and that the name is in `iconMap`
  in `src/lib/icons.ts`.
- **Wrong site URL in links or metadata**: set `APP_URL` in the environment.
