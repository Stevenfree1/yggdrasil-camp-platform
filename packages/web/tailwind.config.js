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
        cream: {
          DEFAULT: '#FAF7F0',
          warm: '#EFE4D2',
        },
        ink: {
          DEFAULT: '#3A211F',
          soft: '#5B4E43',
          faint: '#7B6755',
        },
        terracotta: '#B96443',
        tan: {
          50: '#FAF7F0',
          100: '#EFE4D2',
          200: '#E8DDCD',
          300: '#D8C7B1',
          400: '#C5B5A0',
          600: '#A9957D',
        },
        gold: {
          DEFAULT: '#B99443',
          muted: '#C49A4D',
          dark: '#8B6B2E',
          400: '#C49A4D',
          500: '#B99443',
          600: '#A38137',
        },
        sage: {
          DEFAULT: '#8E9A86',
          100: '#EFF1E9',
          200: '#E1E5D8',
          300: '#CBD3C0',
          400: '#A8B09E',
          500: '#8E9A86',
          600: '#677461',
          700: '#485C4C',
        },
        'warm-border': '#D8C7B1',
        success: '#2e7d32',
        warning: '#C58B2A',
        error: '#A85C3C',
        info: '#244D61',
      },
      fontFamily: {
        accent: ['var(--font-playfair)', 'Playfair Display', 'serif'],
        body: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
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
