import { campConfig } from './camp.config';

/**
 * Member-area resources shown at /members/resources (and, for entries marked
 * `featured`, on the portal dashboard).
 *
 * Kept in code (not the database) because updates are infrequent, most
 * entries point to external URLs, and editing a file is no harder than an
 * admin form. To add or remove a resource, edit this list and ship a commit.
 *
 * Entries with a real `url` render as clickable cards. Entries with
 * `url: '#'` render as informational cards (no link); use that for
 * "coming soon" or "ask a lead" items.
 *
 * `updatedAt` is the date the resource was last reviewed, as YYYY-MM-DD.
 * `icon` is a lucide icon key resolved by `src/lib/icons.ts`.
 */

export interface CampResource {
  id: string;
  title: string;
  description: string;
  category: 'guide' | 'form' | 'document' | 'link';
  url: string;
  updatedAt: string;
  icon: string;
  /** Show on the portal dashboard as a quick link. */
  featured?: boolean;
}

const contactUrl = (subject: string) =>
  `mailto:${campConfig.email}?subject=${encodeURIComponent(subject)}`;

export const memberResources: CampResource[] = [
  // ── Camp ───────────────────────────────────────────────────────
  {
    id: 'member-faq',
    title: 'Member FAQ',
    description:
      'Dues, early arrival, shifts, strike, housing, power, and what to bring. Start here before you ask.',
    category: 'guide',
    url: '/members/faq',
    updatedAt: '2026-01-15',
    icon: 'book-open',
    featured: true,
  },

  // ── Burning Man basics ─────────────────────────────────────────
  {
    id: 'bm-survival-guide',
    title: 'Burning Man Survival Guide',
    description:
      "The official survival guide. Read this first if it's your first burn: heat, dust, water, and what the city does and does not provide.",
    category: 'guide',
    url: 'https://burningman.org/event/preparation/survival-guide/',
    updatedAt: '2026-01-15',
    icon: 'book-open',
    featured: true,
  },
  {
    id: 'bm-10-principles',
    title: '10 Principles of Burning Man',
    description:
      'The cultural framework everyone at camp opts into: radical inclusion, gifting, decommodification, self-reliance, and more.',
    category: 'guide',
    url: 'https://burningman.org/about/10-principles/',
    updatedAt: '2026-01-15',
    icon: 'compass',
  },
  {
    id: 'bm-first-burn',
    title: "First-Burner's Glossary",
    description:
      'Decode the lingo before you arrive: MOOP, playa name, WAP, DGS, art car, and the rest.',
    category: 'guide',
    url: 'https://burningman.org/event/preparation/your-first-burn/glossary/',
    updatedAt: '2026-01-15',
    icon: 'book-open',
  },
  {
    id: 'bm-leave-no-trace',
    title: 'Leave No Trace',
    description:
      'How the city stays clean: MOOP, grey water, and why our placement depends on a spotless plot after strike.',
    category: 'guide',
    url: 'https://burningman.org/about/10-principles/#leave-no-trace',
    updatedAt: '2026-01-15',
    icon: 'leaf',
  },

  // ── Forms ──────────────────────────────────────────────────────
  {
    id: 'membership-application',
    title: 'Membership Application',
    description: `Share this with anyone who wants to join ${campConfig.name}. Every person fills out their own form.`,
    category: 'form',
    url: '/apply',
    updatedAt: '2026-01-15',
    icon: 'file-text',
  },

  // ── Documents ──────────────────────────────────────────────────
  {
    id: 'packing-list',
    title: 'Packing List',
    description:
      'The camp packing checklist is shared by the leads each season. Ask in the members area if you have not received it.',
    category: 'document',
    url: '#',
    updatedAt: '2026-01-15',
    icon: 'clipboard-list',
  },
  {
    id: 'payment-receipt',
    title: 'Dues Receipt',
    description: 'Need a receipt for your dues or a contribution? Email the camp and we will send one.',
    category: 'document',
    url: contactUrl('Receipt request'),
    updatedAt: '2026-01-15',
    icon: 'file-text',
  },

  // ── Contact ────────────────────────────────────────────────────
  {
    id: 'contact-leads',
    title: 'Contact the Camp Leads',
    description: `Questions about dues, housing, shifts, or anything else: ${campConfig.email}.`,
    category: 'link',
    url: contactUrl(`${campConfig.shortName} question`),
    updatedAt: '2026-01-15',
    icon: 'mail',
  },
];
