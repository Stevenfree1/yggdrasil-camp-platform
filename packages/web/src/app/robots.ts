import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/metadata';

/**
 * robots.txt
 *
 * The public landing page and apply form are crawlable. Admin, auth, API,
 * and member-only pages are blocked.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url;

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/apply'],
        disallow: [
          '/admin/',
          '/api/',
          '/portal/',
          '/members/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/invite/',
          '/_next/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
