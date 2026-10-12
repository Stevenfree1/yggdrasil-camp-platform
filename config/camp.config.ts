import { CampConfig } from './types';

/**
 * Camp identity.
 *
 * This is the single place the camp's name, contact details, and URLs live.
 * Server code (emails, payment descriptions, exports) and UI both read from
 * here, so renaming the camp is a one-file change. The values below describe
 * a fictional demo camp; replace them with your own.
 */
export const campConfig: CampConfig = {
  // Basic info
  name: 'Camp Dust Devil',
  shortName: 'Dust Devil',
  memberNoun: { singular: 'camper', plural: 'campers' },
  tagline: 'Shade, coffee, and good company on the playa.',
  description:
    'Camp Dust Devil is a Burning Man theme camp built around a 24-hour coffee bar, a shaded lounge, and a crew that shows up for each other before, during, and after the burn.',
  foundingYear: 2018,

  // Organization. Set taxStatus to undefined if the camp is not a registered
  // nonprofit; donation receipts and tax-deductibility copy key off it.
  legalName: 'Camp Dust Devil',
  taxStatus: undefined, // e.g. '501(c)(3)'
  ein: undefined,

  // Contact
  email: 'hello@example.org',
  phone: undefined,
  location: 'Black Rock City, NV',

  // URLs. APP_URL (env) wins at runtime; this is the fallback.
  website: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006',
  domain: 'example.org',

  // Black Rock City address (lodging-map compass). Update yearly after placement.
  brcPlacement: { clock: '7:30', street: 'D' },

  // Social media (leave undefined to hide)
  social: {
    instagram: undefined,
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
