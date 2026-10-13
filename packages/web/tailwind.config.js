/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        sun: '#F3CC61',
        rust: '#B44229',
        night: '#232722',
        cream: {
          DEFAULT: '#FFF4DF',
          warm: '#F3E4C9',
        },
        ink: {
          DEFAULT: '#252720',
          soft: '#55554D',
          faint: '#706E63',
        },
        terracotta: '#B44229',
        tan: {
          50: '#FFF4DF',
          100: '#F3E4C9',
          200: '#E8DDCD',
          300: '#D3C3A5',
          400: '#C5B5A0',
          600: '#A9957D',
        },
        gold: {
          DEFAULT: '#B44229',
          muted: '#B44229',
          dark: '#8C2F1C',
          400: '#B44229',
          500: '#B44229',
          600: '#983720',
        },
        sage: {
          DEFAULT: '#B44229',
          100: '#FBE4D7',
          200: '#F3C5AF',
          300: '#EAB69A',
          400: '#D77B5D',
          500: '#B44229',
          600: '#983720',
          700: '#8C2F1C',
        },
        'warm-border': '#D3C3A5',
        success: '#2e7d32',
        warning: '#C58B2A',
        error: '#A85C3C',
        info: '#244D61',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Arial Narrow', 'sans-serif'],
        accent: ['var(--font-body)', 'Arial', 'sans-serif'],
        body: ['var(--font-body)', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      minHeight: {
        'hero': '100vh',
        'hero-sm': '70vh',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
};
