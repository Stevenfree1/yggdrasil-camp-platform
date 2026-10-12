'use client';

import { LazyMotion, domAnimation } from 'framer-motion';
import { ReactNode } from 'react';

/**
 * Loads the `domAnimation` feature bundle for `motion.*` components used
 * across the app. `strict` is intentionally omitted — turning it on requires
 * migrating every `motion.X` call site to `m.X`, which is a separate cleanup.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      {children}
    </LazyMotion>
  );
}
