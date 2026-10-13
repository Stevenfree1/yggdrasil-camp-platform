/**
 * Tests for the Footer component.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockCamp = {
  name: 'Camp Test Fixture',
  legalName: 'Camp Test Fixture Inc.',
  tagline: 'A test camp',
  taxStatus: '501(c)(3)' as string | undefined,
  ein: undefined as string | undefined,
  email: 'hello@example.com',
  location: 'Black Rock City, NV',
  social: {
    instagram: 'https://instagram.com/example',
    youtube: 'https://youtube.com/@example',
    soundcloud: 'https://soundcloud.com/example',
  },
};

jest.mock('../../hooks/useConfig', () => ({
  useBrandConfig: () => ({ assets: { logo: '/images/brand/wind-mark.svg' } }),
  useCampConfig: () => mockCamp,
  useContentConfig: () => ({
    footer: {
      tagline: 'Shade and coffee for everyone',
      sections: [
        {
          title: 'Camp',
          links: [
            { label: 'Home', href: '/' },
            { label: 'Apply to join', href: '/apply' },
          ],
        },
        {
          title: 'Members',
          links: [
            { label: 'Members area', href: '/members' },
            { label: 'Log in', href: '/login' },
          ],
        },
      ],
      nonprofitBlurb: 'Run by volunteers.',
    },
  }),
}));

import { Footer } from '../../components/footer';

describe('Footer', () => {
  beforeEach(() => {
    mockCamp.taxStatus = '501(c)(3)';
  });

  it('should render the camp name', () => {
    render(<Footer />);
    expect(screen.getByRole('heading', { name: 'Camp Test Fixture' })).toBeInTheDocument();
  });

  it('should render the footer tagline', () => {
    render(<Footer />);
    expect(screen.getByText('Shade and coffee for everyone')).toBeInTheDocument();
  });

  it('should render the configured link sections with hrefs', () => {
    render(<Footer />);
    expect(screen.getByRole('heading', { name: 'Camp' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByText('Apply to join').closest('a')).toHaveAttribute('href', '/apply');
    expect(screen.getByText('Members area').closest('a')).toHaveAttribute('href', '/members');
    expect(screen.getByText('Log in').closest('a')).toHaveAttribute('href', '/login');
  });

  it('should show the organization block when the camp has a tax status', () => {
    render(<Footer />);
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText(/Camp Test Fixture Inc\. is a 501\(c\)\(3\) organization/)).toBeInTheDocument();
  });

  it('should hide the organization block when the camp has no tax status', () => {
    mockCamp.taxStatus = undefined;
    render(<Footer />);
    expect(screen.queryByText('Organization')).not.toBeInTheDocument();
  });

  it('should render social links opening in a new tab', () => {
    render(<Footer />);
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('SoundCloud')).toBeInTheDocument();
    const instagramLink = screen.getByText('Instagram').closest('a');
    expect(instagramLink).toHaveAttribute('target', '_blank');
    expect(instagramLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render email contact', () => {
    render(<Footer />);
    const emailLink = screen.getByText('hello@example.com');
    expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:hello@example.com');
  });

  it('should render copyright with current year and legal name', () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${currentYear}.*Camp Test Fixture Inc\\.`))).toBeInTheDocument();
  });

  it('should render the location', () => {
    render(<Footer />);
    expect(screen.getByText('Black Rock City, NV')).toBeInTheDocument();
  });

  it('should render the footer as a footer element', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('footer')).toBeInTheDocument();
  });
});
