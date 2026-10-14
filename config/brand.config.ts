import { BrandConfig } from './types';

/**
 * Yggdrasil's palette: forest green, warm gold, parchment, and forest ink.
 * Mirrors yggdrasil.camp. Keep CSS tokens in globals.css and Tailwind's
 * palette in sync with this file. Font files are loaded in
 * packages/web/src/app/layout.tsx.
 */
export const brandConfig: BrandConfig = {
  colors: {
    primary: '#2d5a3d', secondary: '#e8d5b0', accent: '#c9a84c', background: '#f5efe0',
    text: { primary: '#1a2a1a', secondary: '#44503f' },
  },
  fonts: {
    display: 'Cinzel', accent: 'Cormorant Garamond', body: 'Inter', ui: 'Inter',
  },
  theme: {
    style: 'nordic-forest',
    patterns: ['wind-lines', 'offset-print'],
    colors: {
      primary: {
        DEFAULT: '#2d5a3d', light: '#4a7c59', dark: '#1a3a2a',
        50: '#eef5f0', 100: '#d6e6dc', 200: '#aecdb9', 300: '#86b596',
        400: '#5a9270', 500: '#2d5a3d', 600: '#265031', 700: '#1f4229',
        800: '#183420', 900: '#0d1a0d',
      },
      secondary: { DEFAULT: '#e8d5b0', light: '#f5e6c8', dark: '#d3c3a5' },
      accent: { DEFAULT: '#c9a84c', light: '#e8c56a', dark: '#a77b16' },
      neutral: {
        50: '#fbf8f0', 100: '#f5efe0', 200: '#e8dcc6', 300: '#d3c3a5',
        400: '#b1ad9f', 500: '#88877a', 600: '#6a6a5e', 700: '#4a503f',
        800: '#2c3326', 900: '#1a2214',
      },
      semantic: { success: '#2E7D32', warning: '#A77B16', error: '#8C2F1C', info: '#244D61' },
      background: { primary: '#f5efe0', secondary: '#e8dcc6', tertiary: '#fbf8f0' },
      text: { primary: '#1a2a1a', secondary: '#44503f', tertiary: '#6a6a5e', inverse: '#f5e6c8' },
      border: { light: '#e6ddc9', DEFAULT: '#d3c3a5', dark: '#88877a' },
    },
    gradients: {
      hero: 'linear-gradient(135deg, #2d5a3d, #1a3a2a)',
      card: 'linear-gradient(135deg, #fbf8f0, #f5efe0)',
      button: 'linear-gradient(90deg, #2d5a3d, #265031)',
      decorative: 'linear-gradient(135deg, #c9a84c, #4a7c59)',
      primary: 'linear-gradient(135deg, #2d5a3d, #1a3a2a)',
      secondary: 'linear-gradient(135deg, #f5efe0, #e8dcc6)',
      accent: 'linear-gradient(135deg, #c9a84c, #e8c56a)',
    },
    shadows: {
      sm: '2px 2px 0 rgba(26,34,20,0.15)', DEFAULT: '4px 4px 0 rgba(26,34,20,0.15)',
      md: '6px 6px 0 rgba(26,34,20,0.15)', lg: '8px 8px 0 rgba(26,34,20,0.15)',
      xl: '10px 10px 0 rgba(26,34,20,0.15)', '2xl': '12px 12px 0 rgba(26,34,20,0.15)',
      inner: 'inset 0 0 0 1px rgba(26,34,20,0.15)', none: 'none',
    },
    radius: {
      none: '0px', sm: '0.125rem', DEFAULT: '0.25rem', md: '0.375rem',
      lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', full: '9999px',
    },
    spacing: {
      xs: '0.5rem', sm: '0.75rem', md: '1rem', lg: '1.5rem', xl: '2.5rem',
      '2xl': '4rem', '3xl': '5.5rem', '4xl': '7.5rem',
    },
  },
  assets: {
    logo: '/images/brand/yggdrasil-mark.png', logoLight: '/images/brand/yggdrasil-mark.png',
    logoDark: '/images/brand/yggdrasil-mark.png', favicon: '/icon.png',
    ogImage: '/images/hero.jpg', heroBackground: '/images/hero.jpg',
  },
};
