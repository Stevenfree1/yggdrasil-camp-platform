# Yggdrasil camp platform — local run notes

Fork of amirhjalali/camp-platform, rebranded to Camp Yggdrasil.

## View it (while the dev server is running)
- App:   http://localhost:3006
- Admin: http://localhost:3006/login  →  admin@example.com / campdemo123  (demo seed)

## Start / restart the server
    cd ~/yggdrasil-camp-platform
    brew services start postgresql@15      # database (once)
    npm run dev                            # http://localhost:3006

## Stack
- Next.js 14 + Postgres (Prisma). Local DB: camp_platform_dev (role: $USER, trust auth).
- Env in packages/web/.env and packages/database/.env (gitignored).

## What was rebranded (vs the Dust Devil template)
- config/camp.config.ts   — identity, contact, social, memberNoun "roots"
- config/brand.config.ts  — forest-green + gold on parchment; Cinzel/Inter
- config/content.config.ts— world-tree / glade / circle copy
- layout.tsx, tailwind.config.js, globals.css, public-site.css — color + font tokens
- public/images/brand/*, hero.webp, app icons — Yggdrasil mark + Spellbound hero

## Still placeholder / to refine later
- brcPlacement in camp.config.ts (set after 2027 placement)
- Demo card images (camp-day/lounge/build-crew.webp) are still generic
- Nav mark is low-res (140px badge); swap in a clean square Yggdrasil logo for crispness
- FAQ / resources / member-faq.config.ts left generic
- Hosting (Mac mini Docker or VPS) — decide after preview

## Role in the member journey (decided 2026-10-14)
TWO systems, no overlap:
- **yggdrasil.camp** (static, Cloudflare Pages) = public front: story, sound journey, applications -> andromeda@ + Google Sheet.
- **This app** = members-only hub: login, dues, shifts, lodging, announcements, admin/roster/season/money. Public landing + /apply are redirected out (see next.config.js redirects). Intended domain: hub.yggdrasil.camp.
Flow: discover+apply on yggdrasil.camp -> you accept -> create their account here -> they log in for dues/shifts/etc.
