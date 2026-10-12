'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MemberPortalNav } from './MemberPortalNav';

interface MemberPortalLayoutProps {
  children: ReactNode;
}

export function MemberPortalLayout({ children }: MemberPortalLayoutProps) {
  return (
    <div className="member-area min-h-screen" style={{ backgroundColor: 'var(--color-cream)' }}>
      <MemberPortalNav />

      {/* Page content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
