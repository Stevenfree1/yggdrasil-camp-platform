import { BrandConfig } from './types';

/**
 * Dust Devil's field-poster palette: rust, sun yellow, paper, and charcoal.
 * Keep CSS tokens in globals.css and Tailwind's palette in sync with this file.
 * Font files are loaded in packages/web/src/app/layout.tsx.
 */
export const brandConfig: BrandConfig = {
  colors: {
    primary: '#B44229', secondary: '#F3E4C9', accent: '#F3CC61', background: '#FFF4DF',
    text: { primary: '#252720', secondary: '#55554D' },
  },
  fonts: {
    display: 'Barlow Condensed', accent: 'Space Grotesk', body: 'Space Grotesk', ui: 'Space Grotesk',
  },
  theme: {
    style: 'desert-field-poster',
    patterns: ['wind-lines', 'offset-print'],
    colors: {
      primary: {
        DEFAULT: '#B44229', light: '#D77B5D', dark: '#8C2F1C',
        50: '#FFF3ED', 100: '#FBE4D7', 200: '#F3C5AF', 300: '#EAB69A',
        400: '#D77B5D', 500: '#B44229', 600: '#983720', 700: '#8C2F1C',
        800: '#702D21', 900: '#4B241B',
      },
      secondary: { DEFAULT: '#F3E4C9', light: '#FFF4DF', dark: '#D3C3A5' },
      accent: { DEFAULT: '#F3CC61', light: '#FAE5A3', dark: '#A77B16' },
      neutral: {
        50: '#FFFBF1', 100: '#FFF4DF', 200: '#F3E4C9', 300: '#D3C3A5',
        400: '#B1AD9F', 500: '#88877A', 600: '#706E63', 700: '#55554D',
        800: '#383C32', 900: '#252720',
      },
      semantic: { success: '#2E7D32', warning: '#A77B16', error: '#B44229', info: '#244D61' },
      background: { primary: '#FFF4DF', secondary: '#F3E4C9', tertiary: '#FFFBF1' },
      text: { primary: '#252720', secondary: '#55554D', tertiary: '#706E63', inverse: '#FFF4DF' },
      border: { light: '#E8DDC7', DEFAULT: '#D3C3A5', dark: '#88877A' },
    },
    gradients: {
      hero: 'linear-gradient(135deg, #B44229, #8C2F1C)',
      card: 'linear-gradient(135deg, #FFFBF1, #FFF4DF)',
      button: 'linear-gradient(90deg, #B44229, #983720)',
      decorative: 'linear-gradient(135deg, #F3CC61, #D77B5D)',
      primary: 'linear-gradient(135deg, #B44229, #8C2F1C)',
      secondary: 'linear-gradient(135deg, #FFF4DF, #F3E4C9)',
      accent: 'linear-gradient(135deg, #F3CC61, #FAE5A3)',
    },
    shadows: {
      sm: '2px 2px 0 rgba(37,39,32,0.15)', DEFAULT: '4px 4px 0 rgba(37,39,32,0.15)',
      md: '6px 6px 0 rgba(37,39,32,0.15)', lg: '8px 8px 0 rgba(37,39,32,0.15)',
      xl: '10px 10px 0 rgba(37,39,32,0.15)', '2xl': '12px 12px 0 rgba(37,39,32,0.15)',
      inner: 'inset 0 0 0 1px rgba(37,39,32,0.15)', none: 'none',
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
    logo: '/images/brand/wind-mark.svg', logoLight: '/images/brand/wind-mark.svg',
    logoDark: '/images/brand/wind-mark.svg', favicon: '/icon.png',
    ogImage: '/images/hero.webp', heroBackground: '/images/hero.webp',
  },
};
