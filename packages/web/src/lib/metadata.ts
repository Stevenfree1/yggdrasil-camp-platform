import { Metadata } from 'next';
import { getBrandConfig, getCampConfig } from './config';

/**
 * Centralized SEO metadata.
 *
 * Everything here is derived from config/camp.config.ts and
 * config/brand.config.ts, so renaming the camp updates titles, Open Graph
 * tags, and JSON-LD in one place. Each page's layout.tsx imports from
 * `pageMetadata`.
 */

const camp = getCampConfig();
const brand = getBrandConfig();

function absoluteUrl(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

const siteUrl = camp.website.replace(/\/$/, '');

export const siteConfig = {
  name: camp.name,
  legalName: camp.legalName,
  description: camp.description,
  shortDescription: camp.tagline,
  url: siteUrl,
  ogImage: absoluteUrl(siteUrl, brand.assets.ogImage),
  logo: absoluteUrl(siteUrl, brand.assets.logo),
  foundingYear: camp.foundingYear,
  email: camp.email,
  location: camp.location,
  taxStatus: camp.taxStatus,
  locale: 'en_US',
  /** Social profile URLs that are configured (undefined entries removed) */
  links: Object.fromEntries(
    Object.entries(camp.social).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as Record<string, string>,
  keywords: [
    camp.name,
    'Burning Man',
    'Burning Man theme camp',
    'Black Rock City',
    'theme camp',
    'playa',
  ],
};

/** Twitter/X handle derived from the configured profile URL, if any. */
function twitterHandle(): string | undefined {
  const url = camp.social.twitter;
  if (!url) return undefined;
  const handle = url.replace(/\/$/, '').split('/').pop();
  return handle ? `@${handle.replace(/^@/, '')}` : undefined;
}

/**
 * Generate fully-qualified metadata for any page.
 */
export function generateMetadata({
  title,
  description,
  image,
  keywords,
  path = '',
  noIndex = false,
  type = 'website',
}: {
  title: string;
  description?: string;
  image?: string;
  keywords?: string[];
  path?: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
}): Metadata {
  const pageDescription = description || siteConfig.description;
  const pageImage = image ? absoluteUrl(siteConfig.url, image) : siteConfig.ogImage;
  const pageUrl = `${siteConfig.url}${path}`;
  const pageTitle = title.includes(siteConfig.name) ? title : `${title} | ${siteConfig.name}`;
  const pageKeywords = keywords
    ? Array.from(new Set([...siteConfig.keywords, ...keywords]))
    : siteConfig.keywords;
  const handle = twitterHandle();

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: pageKeywords,
    authors: [{ name: siteConfig.name, url: siteConfig.url }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    robots: noIndex ? 'noindex,nofollow' : 'index,follow',
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type,
      locale: siteConfig.locale,
      url: pageUrl,
      title: pageTitle,
      description: pageDescription,
      siteName: siteConfig.name,
      images: [
        {
          url: pageImage,
          width: 1200,
          height: 630,
          alt: `${title} - ${siteConfig.name}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [{ url: pageImage, alt: `${title} - ${siteConfig.name}` }],
      ...(handle && { creator: handle, site: handle }),
    },
  };
}

/* ─────────────────────────────────────────────────────────
   Pre-configured metadata for every page that exists
   ───────────────────────────────────────────────────────── */

export const pageMetadata = {
  home: generateMetadata({
    title: `${camp.name}: ${camp.tagline}`,
    description: camp.description,
    path: '',
  }),

  apply: generateMetadata({
    title: `Apply to join ${camp.name}`,
    description: `Interested in camping with ${camp.name} at Burning Man? Fill out our interest form. First-time burners welcome.`,
    path: '/apply',
    keywords: ['apply', 'join', 'membership', 'Burning Man camp application'],
  }),

  members: generateMetadata({
    title: 'Members',
    description: `${camp.name} members area: dues, shifts, housing, announcements, and resources.`,
    path: '/members',
    noIndex: true,
  }),

  login: generateMetadata({
    title: 'Log in',
    description: `Log in to your ${camp.name} account.`,
    path: '/login',
    noIndex: true,
  }),

  forgotPassword: generateMetadata({
    title: 'Reset password',
    description: `Reset your ${camp.name} account password.`,
    path: '/forgot-password',
    noIndex: true,
  }),

  resetPassword: generateMetadata({
    title: 'Set new password',
    description: `Set a new password for your ${camp.name} account.`,
    path: '/reset-password',
    noIndex: true,
  }),

  invite: generateMetadata({
    title: 'Accept invitation',
    description: `Accept your invitation to join ${camp.name}.`,
    path: '/invite',
    noIndex: true,
  }),

  register: generateMetadata({
    title: 'Register',
    description: `Registration for ${camp.name} is by invitation.`,
    path: '/register',
    noIndex: true,
  }),

  portal: generateMetadata({
    title: 'Member portal',
    description: `Your ${camp.name} dashboard: season details, payments, shifts, and profile.`,
    path: '/portal',
    noIndex: true,
  }),

  admin: generateMetadata({
    title: 'Admin',
    description: `${camp.name} admin: members, seasons, applications, and operations.`,
    path: '/admin',
    noIndex: true,
  }),
};

/* ─────────────────────────────────────────────────────────
   JSON-LD structured data
   ───────────────────────────────────────────────────────── */

/**
 * Organization schema. Emitted as NonprofitOrganization when the camp has a
 * configured tax status, otherwise as a plain Organization.
 */
export function generateOrganizationSchema() {
  const sameAs = Object.values(siteConfig.links);
  return {
    '@context': 'https://schema.org',
    '@type': siteConfig.taxStatus ? 'NonprofitOrganization' : 'Organization',
    '@id': `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    description: siteConfig.description,
    url: siteConfig.url,
    logo: {
      '@type': 'ImageObject',
      url: siteConfig.logo,
    },
    image: siteConfig.ogImage,
    ...(siteConfig.foundingYear && { foundingDate: String(siteConfig.foundingYear) }),
    ...(siteConfig.taxStatus && { nonprofitStatus: siteConfig.taxStatus }),
    areaServed: {
      '@type': 'Place',
      name: siteConfig.location,
    },
    ...(sameAs.length > 0 && { sameAs }),
    contactPoint: {
      '@type': 'ContactPoint',
      email: siteConfig.email,
      contactType: 'General Inquiries',
    },
  };
}

/**
 * WebSite schema.
 */
export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteConfig.url}/#website`,
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: 'en-US',
    publisher: {
      '@id': `${siteConfig.url}/#organization`,
    },
  };
}

/**
 * BreadcrumbList schema generator.
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteConfig.url,
      },
      ...items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: item.name,
        item: `${siteConfig.url}${item.path}`,
      })),
    ],
  };
}

/**
 * WebPage schema for individual pages.
 */
export function generateWebPageSchema({
  name,
  description,
  path,
  dateModified,
}: {
  name: string;
  description: string;
  path: string;
  dateModified?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${siteConfig.url}${path}/#webpage`,
    name,
    description,
    url: `${siteConfig.url}${path}`,
    isPartOf: {
      '@id': `${siteConfig.url}/#website`,
    },
    about: {
      '@id': `${siteConfig.url}/#organization`,
    },
    ...(dateModified && { dateModified }),
    inLanguage: 'en-US',
  };
}

/**
 * FAQPage schema for any FAQ-style content.
 */
export function generateFAQPageSchema({
  questions,
  path,
}: {
  questions: Array<{ question: string; answer: string }>;
  path?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(path && { '@id': `${siteConfig.url}${path}/#faq` }),
    ...(path && { url: `${siteConfig.url}${path}` }),
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
}
