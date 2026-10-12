import { BrandConfig } from './types';

/**
 * Brand configuration: colors, fonts, and logo/asset paths.
 *
 * The default palette is a warm desert set (sage, canvas, brass, bone, deep
 * brown) used by the public pages, with a parchment variant for the admin
 * area. The live design tokens the UI actually paints with are CSS variables
 * in packages/web/src/styles/globals.css and Tailwind colors in
 * packages/web/tailwind.config.js; keep those in sync when you change the
 * palette here.
 */
export const brandConfig: BrandConfig = {
  colors: {
    primary: 'rgb(142, 154, 134)',     // Dusty Olive Sage
    secondary: 'rgb(239, 228, 210)',   // Warm Canvas
    accent: 'rgb(185, 148, 67)',       // Antique Brass
    background: 'rgb(250, 247, 240)',  // Bone
    text: {
      primary: 'rgb(58, 33, 31)',      // Deep Brown
      secondary: 'rgb(91, 78, 67)',    // Soft Ink
    },
  },
  fonts: {
    display: 'Playfair Display',
    accent: 'Playfair Display Italic',
    body: 'Inter',
    ui: 'Inter',
  },
  theme: {
    style: 'warm-desert',
    patterns: ['geometric', 'sunburst-rings'],
    colors: {
      primary: {
        DEFAULT: 'rgb(142, 154, 134)',
        light: 'rgb(183, 188, 169)',
        dark: 'rgb(103, 116, 97)',
        50: 'rgb(248, 249, 245)',
        100: 'rgb(239, 241, 233)',
        200: 'rgb(225, 229, 216)',
        300: 'rgb(203, 211, 192)',
        400: 'rgb(168, 176, 158)',
        500: 'rgb(142, 154, 134)',
        600: 'rgb(103, 116, 97)',
        700: 'rgb(72, 92, 76)',
        800: 'rgb(58, 77, 64)',
        900: 'rgb(23, 54, 47)',
      },
      secondary: {
        DEFAULT: 'rgb(239, 228, 210)',
        light: 'rgb(250, 247, 240)',
        dark: 'rgb(197, 181, 160)',
        50: 'rgb(253, 251, 247)',
        100: 'rgb(250, 247, 242)',
        200: 'rgb(239, 228, 210)',
        300: 'rgb(232, 221, 205)',
        400: 'rgb(215, 199, 177)',
        500: 'rgb(197, 181, 160)',
        600: 'rgb(169, 149, 125)',
        700: 'rgb(132, 113, 94)',
        800: 'rgb(91, 78, 67)',
        900: 'rgb(58, 33, 31)',
      },
      accent: {
        DEFAULT: 'rgb(185, 148, 67)',
        light: 'rgb(203, 169, 83)',
        dark: 'rgb(139, 107, 46)',
        50: 'rgb(255, 251, 238)',
        100: 'rgb(249, 240, 213)',
        200: 'rgb(239, 219, 173)',
        300: 'rgb(220, 194, 126)',
        400: 'rgb(203, 169, 83)',
        500: 'rgb(185, 148, 67)',
        600: 'rgb(163, 129, 55)',
        700: 'rgb(139, 107, 46)',
        800: 'rgb(107, 82, 39)',
        900: 'rgb(76, 60, 32)',
      },
      neutral: {
        50: 'rgb(250, 248, 244)',
        100: 'rgb(244, 240, 234)',
        200: 'rgb(230, 222, 210)',
        300: 'rgb(214, 200, 184)',
        400: 'rgb(190, 168, 147)',
        500: 'rgb(164, 138, 115)',
        600: 'rgb(132, 108, 88)',
        700: 'rgb(106, 85, 70)',
        800: 'rgb(79, 63, 51)',
        900: 'rgb(54, 43, 34)',
      },
      semantic: {
        success: 'rgb(46, 125, 50)',
        warning: 'rgb(201, 140, 24)',
        error: 'rgb(176, 59, 46)',
        info: 'rgb(47, 84, 112)',
      },
      background: {
        primary: 'rgb(250, 247, 240)',
        secondary: 'rgb(239, 228, 210)',
        tertiary: 'rgb(252, 250, 247)',
      },
      text: {
        primary: 'rgb(58, 33, 31)',
        secondary: 'rgb(91, 78, 67)',
        tertiary: 'rgb(123, 103, 85)',
        inverse: 'rgb(250, 247, 240)',
      },
      border: {
        light: 'rgb(232, 221, 205)',
        DEFAULT: 'rgb(215, 199, 177)',
        dark: 'rgb(169, 149, 125)',
      },
    },
    gradients: {
      hero: 'linear-gradient(180deg, rgba(250,247,240,0.95) 0%, rgba(239,228,210,0.98) 54%, rgba(185,148,67,0.24) 100%)',
      card: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(250,247,240,0.95) 56%, rgba(239,228,210,0.9) 100%)',
      button: 'linear-gradient(90deg, rgb(142, 154, 134) 0%, rgb(103, 116, 97) 100%)',
      decorative: 'linear-gradient(135deg, rgba(185,148,67,0.24) 0%, rgba(168,176,158,0.42) 50%, rgba(58,33,31,0.28) 100%)',
      primary: 'linear-gradient(135deg, rgb(142, 154, 134) 0%, rgb(103, 116, 97) 100%)',
      secondary: 'linear-gradient(135deg, rgb(250, 247, 240) 0%, rgb(239, 228, 210) 100%)',
      accent: 'linear-gradient(135deg, rgb(185, 148, 67) 0%, rgb(139, 107, 46) 100%)',
    },
    shadows: {
      sm: '0 6px 18px rgba(44, 36, 22, 0.08)',
      DEFAULT: '0 12px 30px rgba(74, 93, 90, 0.12)',
      md: '0 18px 36px rgba(44, 36, 22, 0.14)',
      lg: '0 24px 48px rgba(44, 36, 22, 0.18)',
      xl: '0 30px 60px rgba(44, 36, 22, 0.22)',
      '2xl': '0 36px 72px rgba(33, 28, 18, 0.25)',
      inner: 'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      none: '0 0 #0000',
    },
    radius: {
      none: '0px',
      sm: '0.125rem',
      DEFAULT: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
      '2xl': '1.5rem',
      '3xl': '2.25rem',
      full: '9999px',
    },
    spacing: {
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2.5rem',
      '2xl': '4rem',
      '3xl': '5.5rem',
      '4xl': '7.5rem',
    },
  },
  assets: {
    logo: '/images/brand/logo-512.webp',
    logoLight: '/images/brand/logo-light-512.png',
    logoDark: '/images/brand/logo-dark-512.png',
    favicon: '/icon.png',
    ogImage: '/images/hero.webp',
    heroBackground: '/images/hero.webp',
  },
};
