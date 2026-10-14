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
        sun: '#C9A84C',
        rust: '#2D5A3D',
        night: '#1A2214',
        cream: {
          DEFAULT: '#F5EFE0',
          warm: '#E8DCC6',
        },
        ink: {
          DEFAULT: '#1A2A1A',
          soft: '#55554D',
          faint: '#706E63',
        },
        terracotta: '#2D5A3D',
        tan: {
          50: '#F5EFE0',
          100: '#E8DCC6',
          200: '#E8DDCD',
          300: '#D3C3A5',
          400: '#C5B5A0',
          600: '#A9957D',
        },
        gold: {
          DEFAULT: '#2D5A3D',
          muted: '#2D5A3D',
          dark: '#1A3A2A',
          400: '#2D5A3D',
          500: '#2D5A3D',
          600: '#265031',
        },
        sage: {
          DEFAULT: '#2D5A3D',
          100: '#D6E6DC',
          200: '#AECDB9',
          300: '#86B596',
          400: '#4A7C59',
          500: '#2D5A3D',
          600: '#265031',
          700: '#1A3A2A',
        },
        'warm-border': '#D3C3A5',
        success: '#2e7d32',
        warning: '#A77B16',
        error: '#3F6B4A',
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
