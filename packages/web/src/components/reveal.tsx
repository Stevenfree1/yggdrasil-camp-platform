'use client';

import { useRef, useMemo } from 'react';
import { m, useInView, useReducedMotion } from 'framer-motion';

const directionMap = {
  up: { y: 32, x: 0 },
  down: { y: -32, x: 0 },
  left: { x: -40, y: 0 },
  right: { x: 40, y: 0 },
  none: { x: 0, y: 0 },
} as const;

const transitionBase = {
  duration: 0.7,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function Reveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const prefersReducedMotion = useReducedMotion();

  const { x, y } = directionMap[direction];

  const transition = useMemo(
    () => ({ ...transitionBase, delay }),
    [delay]
  );

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x, y }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x, y }}
      transition={transition}
    >
      {children}
    </m.div>
  );
}
