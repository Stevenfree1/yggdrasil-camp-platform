/**
 * Global Jest setup.
 *
 * Runs before every test file. Sets up `@testing-library/jest-dom` custom
 * matchers and installs DOM polyfills that jsdom doesn't ship by default but
 * that framer-motion / next.js components rely on at runtime.
 */
import '@testing-library/jest-dom';

// jsdom doesn't implement IntersectionObserver; framer-motion's `useInView`
// and `whileInView` call it the moment a component mounts.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    MockIntersectionObserver;
}

// Some framer-motion animations / components observe element size.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    MockResizeObserver;
}

// next-themes and responsive components call matchMedia at mount.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
