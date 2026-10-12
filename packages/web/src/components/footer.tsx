'use client';

import { memo, forwardRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail } from 'lucide-react';
import { useCampConfig, useContentConfig } from '../hooks/useConfig';

// Brand glyphs (Simple Icons, CC0 — single-path, recolored to currentColor so
// they inherit the footer's cream/gold theme). Crisp at any size, unlike a
// raster logo.
const SOCIAL_GLYPHS: Record<string, string> = {
  Instagram:
    'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  YouTube:
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  SoundCloud:
    'M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z',
};

function SocialGlyph({ name, className = '' }: { name: string; className?: string }) {
  const d = SOCIAL_GLYPHS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

type FooterVariant = 'gradient' | 'sage' | 'ink' | 'burgundy';

export const Footer = memo(forwardRef(function Footer({ variant = 'gradient' }: { variant?: FooterVariant } = {}, _ref) {
  const campConfig = useCampConfig();
  const { footer } = useContentConfig();

  const currentYear = new Date().getFullYear();

  const navSections = footer.sections;

  const socialLinks = [
    campConfig.social?.instagram && { label: 'Instagram', href: campConfig.social.instagram },
    campConfig.social?.youtube && { label: 'YouTube', href: campConfig.social.youtube },
    campConfig.social?.soundcloud && { label: 'SoundCloud', href: campConfig.social.soundcloud },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer className="relative" role="contentinfo">

      {/* Main footer area — variant-driven background */}
      <div
        className="footer-band relative"
        style={{ color: 'var(--color-cream)' }}
      >
        {/* Gold hairline along the top edge */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent 4%, rgba(var(--color-gold-rgb), 0.9) 50%, transparent 96%)',
            boxShadow: '0 0 10px rgba(var(--color-gold-rgb), 0.4)',
          }}
          aria-hidden="true"
        />
        {/* Subtle geometric pattern overlay — only on the legacy gradient
            variant; textured variants already carry their own pattern */}
        {variant === 'gradient' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='none' stroke='%23c4a94d' stroke-width='0.5'/%3E%3Cpath d='M30 10L50 30L30 50L10 30z' fill='none' stroke='%23c4a94d' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: '60px 60px',
            }}
            aria-hidden="true"
          />
        )}

        <div className="relative max-w-[1200px] mx-auto px-6 md:px-10">
          {/* Upper section */}
          <div className="pt-20 md:pt-24 pb-16 md:pb-20">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8 lg:gap-16">
              {/* Brand Column - takes more space */}
              <div
                className="md:col-span-5 space-y-6"
              >
                <div className="flex items-center gap-4">
                  <Image
                    src="/images/brand/logo-256.webp"
                    alt={campConfig.name}
                    width={56}
                    height={56}
                    className="h-14 w-auto object-contain"
                  />
                  <div>
                  <h3
                    className="font-display text-2xl md:text-3xl uppercase tracking-[0.16em]"
                    style={{ color: 'var(--color-cream)' }}
                  >
                    {campConfig.name}
                  </h3>
                  </div>
                </div>

                <p
                  className="font-body text-sm max-w-xs leading-[1.8]"
                  style={{ color: 'rgba(var(--color-cream-rgb), 0.65)' }}
                >
                  {footer.tagline || campConfig.tagline}
                </p>

                {/* Social links as themed brand-icon tiles */}
                {socialLinks.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {socialLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Follow ${campConfig.name} on ${link.label} (opens in new tab)`}
                        className="group relative inline-flex h-11 w-11 items-center justify-center rounded-sm transition-all duration-300 hover:-translate-y-0.5"
                        style={{
                          border: '1px solid rgba(var(--color-cream-rgb), 0.14)',
                          color: 'rgba(var(--color-cream-rgb), 0.7)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-gold-muted)';
                          e.currentTarget.style.color = 'var(--color-gold)';
                          e.currentTarget.style.backgroundColor = 'rgba(var(--color-cream-rgb), 0.04)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(var(--color-cream-rgb), 0.14)';
                          e.currentTarget.style.color = 'rgba(var(--color-cream-rgb), 0.7)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <SocialGlyph name={link.label} className="h-[18px] w-[18px]" />
                        <span className="sr-only">{link.label}</span>
                      </a>
                    ))}
                  </div>
                )}

                {/* Email */}
                {campConfig.email && (
                  <a
                    href={`mailto:${campConfig.email}`}
                    aria-label={`Send email to ${campConfig.email}`}
                    className="group inline-flex items-center gap-2 text-sm transition-colors duration-300 pt-1"
                    style={{ color: 'rgba(var(--color-cream-rgb), 0.55)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-gold-muted)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'rgba(var(--color-cream-rgb), 0.55)';
                    }}
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{campConfig.email}</span>
                  </a>
                )}
              </div>

              {/* Navigation Columns */}
              {navSections.map((section) => (
                <div
                  key={section.title}
                  className="md:col-span-2 space-y-5"
                >
                  <h4
                    className="text-[11px] tracking-[0.25em] uppercase font-medium"
                    style={{ color: 'rgba(var(--color-cream-rgb), 0.4)' }}
                  >
                    {section.title}
                  </h4>
                  <nav
                    aria-label={`${section.title} links`}
                    className="space-y-0"
                  >
                    <ul className="space-y-0">
                      {section.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className="inline-block -mx-4 rounded-full px-4 py-2.5 text-sm text-cream/65 transition-colors duration-300 hover:bg-cream/20 hover:text-cream dark:hover:bg-gold/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              ))}

              {/* Organization column — only for registered nonprofits */}
              {campConfig.taxStatus && (
                <div className="md:col-span-3 space-y-5">
                  <h4
                    className="text-[11px] tracking-[0.25em] uppercase font-medium"
                    style={{ color: 'rgba(var(--color-cream-rgb), 0.4)' }}
                  >
                    Organization
                  </h4>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'rgba(var(--color-cream-rgb), 0.55)' }}
                  >
                    {campConfig.legalName} is a {campConfig.taxStatus} organization.
                    {footer.nonprofitBlurb ? ` ${footer.nonprofitBlurb}` : ''}
                  </p>
                  {campConfig.ein && (
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: 'rgba(var(--color-cream-rgb), 0.35)' }}
                    >
                      EIN {campConfig.ein}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Decorative divider */}

          {/* Bottom Bar */}
          <div className="py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p
                className="text-[11px] tracking-[0.04em]"
                style={{ color: 'rgba(var(--color-cream-rgb), 0.35)' }}
              >
                &copy; {currentYear} {campConfig.legalName || campConfig.name}. All rights reserved.
              </p>

              <div className="flex items-center gap-6">
                <p
                  className="text-[11px] tracking-[0.12em] uppercase flex items-center gap-2"
                  style={{ color: 'rgba(var(--color-cream-rgb), 0.3)' }}
                >
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--color-gold-muted)', opacity: 0.4 }}
                    aria-hidden="true"
                  />
                  {campConfig.location}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}));
