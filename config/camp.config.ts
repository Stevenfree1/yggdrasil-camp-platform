import { CampConfig } from './types';

/**
 * Camp identity.
 *
 * This is the single place the camp's name, contact details, and URLs live.
 * Server code (emails, payment descriptions, exports) and UI both read from
 * here, so renaming the camp is a one-file change.
 */
export const campConfig: CampConfig = {
  // Basic info
  name: 'Camp Yggdrasil',
  shortName: 'Yggdrasil',
  memberNoun: { singular: 'root', plural: 'roots' },
  tagline: 'Shade, story, and a circle under the tree.',
  description:
    'Camp Yggdrasil is a Burning Man theme camp built around a hand-raised world-tree that casts real shade, a glade to gather in, and a small circle that builds it together and takes it down together, leaving no trace.',
  foundingYear: 2023,

  // Organization. Set taxStatus to undefined if the camp is not a registered
  // nonprofit; donation receipts and tax-deductibility copy key off it.
  legalName: 'Camp Yggdrasil',
  taxStatus: undefined, // e.g. '501(c)(3)'
  ein: undefined,

  // Contact
  email: 'andromeda@yggdrasil.camp',
  phone: undefined,
  location: 'Black Rock City, NV',

  // URLs. APP_URL (env) wins at runtime; this is the fallback.
  website: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://yggdrasil.camp',
  domain: 'yggdrasil.camp',

  // Black Rock City address (lodging-map compass). PLACEHOLDER — update after
  // 2027 placement comes out.
  brcPlacement: { clock: '7:30', street: 'D' },

  // Social media (leave undefined to hide)
  social: {
    instagram: 'https://instagram.com/camp.yggdrasil',
    facebook: undefined,
    twitter: undefined,
    youtube: undefined,
    soundcloud: undefined,
  },

  // Features: toggle optional areas on/off
  features: {
    events: false,
    donations: false,
    membership: true,
    forum: false,
    gallery: false,
    newsletter: false,
  },
};
