import { MetadataRoute } from 'next';
import { getCampConfig } from '@/lib/config';

/**
 * Web App Manifest, used when the site is installed or added to a home screen.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
 */
export default function manifest(): MetadataRoute.Manifest {
  const camp = getCampConfig();

  return {
    name: camp.name,
    short_name: camp.shortName,
    description: camp.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#17362F',
    theme_color: '#17362F',
    icons: [
      {
        src: '/images/brand/app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/brand/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/brand/app-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['community', 'lifestyle'],
  };
}
