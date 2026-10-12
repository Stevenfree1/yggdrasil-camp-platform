import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/metadata';

/**
 * sitemap.xml. Only the public pages are listed; everything else is behind
 * a login and blocked in robots.ts.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;

  const pages: Array<{
    path: string;
    priority: number;
    changeFrequency: 'weekly' | 'monthly';
  }> = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/apply', priority: 0.9, changeFrequency: 'monthly' },
  ];

  return pages.map((page) => ({
    url: `${baseUrl}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
