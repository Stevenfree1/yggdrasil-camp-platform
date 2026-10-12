/**
 * Tests for the Navigation component.
 *
 * We mock external dependencies (framer-motion, next/navigation, next-themes, config hooks)
 * so the component can render in a test environment.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock framer-motion.
// `motion` is a Proxy so any tag (motion.nav, motion.button, motion.li, …)
// is auto-stubbed as the corresponding plain HTML element with motion-only
// props stripped.
jest.mock('framer-motion', () => {
  const React = require('react');
  const makeStub = (tag: string) => {
    const Component = ({ children, ...props }: any) =>
      React.createElement(tag, filterProps(props), children);
    Component.displayName = `MotionStub(${tag})`;
    return Component;
  };
  const motion: any = new Proxy(
    {},
    {
      get: (_target, prop: string) => makeStub(prop),
    }
  );
  return {
    motion,
    m: motion,
    LazyMotion: ({ children }: any) => <>{children}</>,
    domAnimation: {},
    domMax: {},
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useScroll: () => ({ scrollY: { get: () => 0, on: () => () => {} } }),
    useMotionValueEvent: () => {},
    useTransform: () => 0,
    useMotionValue: (initial: number) => ({ get: () => initial, set: () => {} }),
    useSpring: (value: any) => value,
    useReducedMotion: () => false,
    useInView: () => true,
  };
});

// Helper to remove motion-specific props from DOM elements
function filterProps(props: any) {
  const {
    initial, animate, exit, transition, whileHover, whileInView, whileTap,
    viewport, variants, layout, layoutId, ...rest
  } = props;
  return rest;
}

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

// Mock the config hooks
jest.mock('../../hooks/useConfig', () => ({
  useCampConfig: () => ({
    name: 'Camp Test Fixture',
    tagline: 'A test camp',
    social: {},
  }),
  useContentConfig: () => ({
    navigation: {
      lockupSubtitle: 'Burning Man theme camp',
      items: [
        { label: 'Home', href: '/' },
        { label: 'Apply', href: '/apply' },
        { label: 'Members', href: '/members' },
      ],
    },
  }),
}));

// Mock auth (signed out by default; individual tests override)
const mockAuth = {
  user: null as null | { role: string; adminScopes: string[] },
  isAuthenticated: false,
};
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
  hasAdminAccess: (user: { role: string; adminScopes: string[] } | null) =>
    !!user && (user.role === 'LEAD' || user.role === 'MANAGER' || user.adminScopes.length > 0),
}));

import { Navigation } from '../../components/navigation';

describe('Navigation', () => {
  beforeEach(() => {
    mockAuth.user = null;
    mockAuth.isAuthenticated = false;
  });

  it('should render the camp name as logo text', () => {
    render(<Navigation />);
    expect(screen.getByText('Camp Test Fixture')).toBeInTheDocument();
  });

  it('should render the configured navigation items with hrefs', () => {
    render(<Navigation />);
    expect(screen.getByText('Home').closest('a')).toHaveAttribute('href', '/');
    expect(screen.getByText('Apply').closest('a')).toHaveAttribute('href', '/apply');
    expect(screen.getByText('Members').closest('a')).toHaveAttribute('href', '/members');
  });

  it('should not link to removed marketing pages', () => {
    const { container } = render(<Navigation />);
    for (const href of ['/about', '/art', '/events', '/culture', '/donate', '/search']) {
      expect(container.querySelector(`a[href="${href}"]`)).toBeNull();
    }
  });

  it('should show a Log in link when signed out', () => {
    render(<Navigation />);
    expect(screen.getByText('Log in').closest('a')).toHaveAttribute('href', '/login');
    expect(screen.queryByText('Portal')).not.toBeInTheDocument();
  });

  it('should show Portal (not Admin) for a signed-in member', () => {
    mockAuth.user = { role: 'MEMBER', adminScopes: [] };
    mockAuth.isAuthenticated = true;
    render(<Navigation />);
    expect(screen.getByText('Portal').closest('a')).toHaveAttribute('href', '/portal');
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Log in')).not.toBeInTheDocument();
  });

  it('should show Admin for a camp lead', () => {
    mockAuth.user = { role: 'LEAD', adminScopes: [] };
    mockAuth.isAuthenticated = true;
    render(<Navigation />);
    expect(screen.getByText('Admin').closest('a')).toHaveAttribute('href', '/admin');
  });

  it('should have a mobile menu toggle button', () => {
    render(<Navigation />);
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  it('should have a dark mode toggle button', () => {
    render(<Navigation />);
    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
  });

  it('should have the logo as a link to homepage', () => {
    render(<Navigation />);
    const logoLink = screen.getByText('Camp Test Fixture').closest('a');
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('should have accessible navigation landmarks', () => {
    render(<Navigation />);
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });
});
