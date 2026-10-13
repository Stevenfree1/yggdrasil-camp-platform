import { ReactNode, Suspense } from "react";
import type { Viewport } from 'next';
import "../styles/globals.css";
import "../styles/public-site.css";
import { Barlow_Condensed, Space_Grotesk } from 'next/font/google';
import { ThemeProvider } from '../components/theme-provider';
import { MotionProvider } from '../components/motion-provider';
import { AuthProvider } from '../contexts/AuthContext';
import { TrpcProvider } from '../components/TrpcProvider';
import { SiteShell } from '../components/site-shell';
import { StructuredData } from '../components/structured-data';
import { pageMetadata } from '@/lib/metadata';
import { Toaster } from 'sonner';
import { GoogleAnalytics } from '@next/third-parties/google';

const display = Barlow_Condensed({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
  display: 'swap',
  preload: true,
});

const body = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
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
    { media: '(prefers-color-scheme: light)', color: '#FFF4DF' },
    { media: '(prefers-color-scheme: dark)', color: '#232722' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} scroll-smooth`} suppressHydrationWarning>
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
