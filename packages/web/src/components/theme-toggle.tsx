'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * Light/dark toggle, identical to the one in the public top nav. Extracted so it
 * can also be dropped into the member portal (which doesn't render the public
 * nav). Renders nothing until mounted to avoid a hydration mismatch.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <motion.button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2.5 text-ink-soft transition-all duration-300 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 ${className}`}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      whileTap={{ scale: 0.9 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.2 }}
          className="block"
        >
          {theme === 'dark' ? (
            <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
          ) : (
            <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
