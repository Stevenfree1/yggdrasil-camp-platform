/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Members-only hub. Public marketing + applications live on yggdrasil.camp.
  async redirects() {
    return [
      // No public landing here: send everyone to the member portal
      // (which bounces to /login when signed out).
      { source: '/', destination: '/members', permanent: false },
      // Applications happen on the public site, not here.
      { source: '/apply', destination: 'https://yggdrasil.camp/apply/burning-man', permanent: false },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
  webpack: (config, { isServer }) => {
    // Konva's Node entry pulls in the native `canvas` package, which we don't
    // need (we only run Konva in the browser via dynamic import). Mark it as
    // an external so webpack doesn't try to bundle it.
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas'];
    }
    return config;
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  images: {
    // WebP only. AVIF encodes ~2-3x slower per image and the optimizer runs
    // on a CPU-limited self-hosted container with no CDN in front, so the AVIF
    // win in bytes isn't worth the cold-encode latency. Requires `sharp`
    // (a dependency) — without it Next falls back to a much slower WASM encoder.
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.instagram.com',
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // Long-lived cache for static assets (images, fonts, etc.)
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache for Next.js static assets. Prod-only: prod chunk URLs are
      // content-hashed so immutable is safe; dev chunk URLs are NOT hashed,
      // and an immutable header makes browsers pin stale lazy-loaded chunks
      // (dynamic imports bypass even a hard reload's cache-busting).
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/_next/static/:path*',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]
        : []),
      {
        // Short cache for HTML pages (revalidate frequently)
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'accept',
            value: '(.*text/html.*)',
          },
        ],
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
