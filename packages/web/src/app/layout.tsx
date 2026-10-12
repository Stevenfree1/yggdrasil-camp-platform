import { ReactNode, Suspense } from "react";
import type { Viewport } from 'next';
import "../styles/globals.css";
import { Playfair_Display, Inter } from 'next/font/google';
import { ThemeProvider } from '../components/theme-provider';
import { MotionProvider } from '../components/motion-provider';
import { AuthProvider } from '../contexts/AuthContext';
import { TrpcProvider } from '../components/TrpcProvider';
import { SiteShell } from '../components/site-shell';
import { StructuredData } from '../components/structured-data';
import { pageMetadata } from '@/lib/metadata';
import { Toaster } from 'sonner';
import { GoogleAnalytics } from '@next/third-parties/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: true,
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500'],
  display: 'swap',
  preload: true,
});

// Use centralized metadata configuration
export const metadata = pageMetadata.home;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F0' },
    { media: '(prefers-color-scheme: dark)', color: '#17362F' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <StructuredData />
      </head>
      <body className="font-body antialiased">
        <div className="grain-overlay" aria-hidden="true" />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <MotionProvider>
            <TrpcProvider>
              <AuthProvider>
                <SiteShell>
                  <Suspense>{children}</Suspense>
                </SiteShell>
                <Toaster position="top-right" richColors closeButton />
              </AuthProvider>
            </TrpcProvider>
          </MotionProvider>
        </ThemeProvider>
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        ) : null}
      </body>
    </html>
  );
}
