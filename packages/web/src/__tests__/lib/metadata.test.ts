import {
  siteConfig,
  generateMetadata,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateBreadcrumbSchema,
  generateWebPageSchema,
  generateFAQPageSchema,
  pageMetadata,
} from '../../lib/metadata';
import { campConfig } from '../../../../../config/camp.config';

describe('siteConfig', () => {
  it('should be derived from the camp config', () => {
    expect(siteConfig.name).toBe(campConfig.name);
    expect(siteConfig.legalName).toBe(campConfig.legalName);
    expect(siteConfig.description).toBe(campConfig.description);
    expect(siteConfig.email).toBe(campConfig.email);
    expect(siteConfig.url).toBe(campConfig.website.replace(/\/$/, ''));
  });

  it('should have an absolute og image and keywords', () => {
    expect(siteConfig.ogImage).toMatch(/^https?:\/\//);
    expect(siteConfig.keywords).toContain(campConfig.name);
    expect(siteConfig.keywords).toContain('Burning Man');
  });

  it('should only list configured social links', () => {
    for (const value of Object.values(siteConfig.links)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('generateMetadata', () => {
  it('should append the site name to the title', () => {
    const meta = generateMetadata({ title: 'Apply' });
    expect(meta.title).toBe(`Apply | ${siteConfig.name}`);
  });

  it('should not double-append site name if already included', () => {
    const meta = generateMetadata({ title: `${siteConfig.name} | Home` });
    expect(meta.title).toBe(`${siteConfig.name} | Home`);
  });

  it('should use default description when none provided', () => {
    const meta = generateMetadata({ title: 'Test' });
    expect(meta.description).toBe(siteConfig.description);
  });

  it('should use custom description when provided', () => {
    const meta = generateMetadata({ title: 'Test', description: 'Custom description' });
    expect(meta.description).toBe('Custom description');
  });

  it('should set canonical URL', () => {
    const meta = generateMetadata({ title: 'Apply', path: '/apply' });
    expect(meta.alternates?.canonical).toBe(`${siteConfig.url}/apply`);
  });

  it('should merge custom keywords with default keywords', () => {
    const meta = generateMetadata({ title: 'Test', keywords: ['custom-keyword'] });
    const keywords = meta.keywords as string[];
    expect(keywords).toContain('custom-keyword');
    expect(keywords).toContain(siteConfig.name);
  });

  it('should set robots based on noIndex', () => {
    expect(generateMetadata({ title: 'Private', noIndex: true }).robots).toBe('noindex,nofollow');
    expect(generateMetadata({ title: 'Public' }).robots).toBe('index,follow');
  });

  it('should include Open Graph data', () => {
    const meta = generateMetadata({ title: 'Test', path: '/test' });
    expect((meta.openGraph as any)?.type).toBe('website');
    expect(meta.openGraph?.url).toBe(`${siteConfig.url}/test`);
    expect(meta.openGraph?.siteName).toBe(siteConfig.name);
  });

  it('should include Twitter card data', () => {
    const meta = generateMetadata({ title: 'Test' });
    expect((meta.twitter as any)?.card).toBe('summary_large_image');
  });

  it('should use a custom absolute image as-is', () => {
    const meta = generateMetadata({ title: 'Test', image: 'https://example.com/image.jpg' });
    const ogImages = meta.openGraph?.images as any[];
    expect(ogImages?.[0]?.url).toBe('https://example.com/image.jpg');
  });

  it('should resolve a relative image against the site URL', () => {
    const meta = generateMetadata({ title: 'Test', image: '/images/hero.webp' });
    const ogImages = meta.openGraph?.images as any[];
    expect(ogImages?.[0]?.url).toBe(`${siteConfig.url}/images/hero.webp`);
  });
});

describe('pageMetadata', () => {
  it('should have metadata for every remaining page', () => {
    for (const key of [
      'home',
      'apply',
      'members',
      'login',
      'forgotPassword',
      'resetPassword',
      'invite',
      'register',
      'portal',
      'admin',
    ] as const) {
      expect(pageMetadata[key]).toBeDefined();
    }
  });

  it('should not keep metadata for removed marketing pages', () => {
    for (const key of ['about', 'art', 'events', 'culture', 'donate', 'search']) {
      expect((pageMetadata as Record<string, unknown>)[key]).toBeUndefined();
    }
  });

  it('should index public pages and noindex private ones', () => {
    expect(pageMetadata.home.robots).toBe('index,follow');
    expect(pageMetadata.apply.robots).toBe('index,follow');
    expect(pageMetadata.members.robots).toBe('noindex,nofollow');
    expect(pageMetadata.portal.robots).toBe('noindex,nofollow');
    expect(pageMetadata.admin.robots).toBe('noindex,nofollow');
  });
});

describe('generateOrganizationSchema', () => {
  it('should generate valid JSON-LD from config', () => {
    const schema = generateOrganizationSchema();
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe(campConfig.taxStatus ? 'NonprofitOrganization' : 'Organization');
    expect(schema.name).toBe(campConfig.name);
    expect(schema.legalName).toBe(campConfig.legalName);
    expect(schema.url).toBe(siteConfig.url);
    expect(schema.contactPoint.email).toBe(campConfig.email);
  });

  it('should derive foundingDate from config when set', () => {
    const schema = generateOrganizationSchema() as Record<string, unknown>;
    if (campConfig.foundingYear) {
      expect(schema.foundingDate).toBe(String(campConfig.foundingYear));
    } else {
      expect(schema.foundingDate).toBeUndefined();
    }
  });
});

describe('generateWebSiteSchema', () => {
  it('should reference the organization as publisher via @id', () => {
    const schema = generateWebSiteSchema();
    expect(schema['@type']).toBe('WebSite');
    expect(schema.publisher['@id']).toBe(`${siteConfig.url}/#organization`);
  });
});

describe('generateBreadcrumbSchema', () => {
  it('should begin with Home and append items with absolute URLs', () => {
    const schema = generateBreadcrumbSchema([{ name: 'Apply', path: '/apply' }]);
    expect(schema.itemListElement[0]).toMatchObject({ position: 1, name: 'Home', item: siteConfig.url });
    expect(schema.itemListElement[1]).toMatchObject({
      position: 2,
      name: 'Apply',
      item: `${siteConfig.url}/apply`,
    });
  });
});

describe('generateWebPageSchema', () => {
  it('should link the page to the website and organization', () => {
    const schema = generateWebPageSchema({ name: 'Apply', description: 'd', path: '/apply' });
    expect(schema.url).toBe(`${siteConfig.url}/apply`);
    expect(schema.isPartOf['@id']).toBe(`${siteConfig.url}/#website`);
    expect(schema.about['@id']).toBe(`${siteConfig.url}/#organization`);
  });
});

describe('generateFAQPageSchema', () => {
  it('should map question/answer pairs to schema.org Question + Answer', () => {
    const schema = generateFAQPageSchema({
      questions: [{ question: 'Q?', answer: 'A.' }],
      path: '/members/faq',
    }) as Record<string, any>;
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.url).toBe(`${siteConfig.url}/members/faq`);
    expect(schema.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'Q?',
      acceptedAnswer: { '@type': 'Answer', text: 'A.' },
    });
  });

  it('should omit url and @id when path is not provided', () => {
    const schema = generateFAQPageSchema({ questions: [] }) as Record<string, unknown>;
    expect(schema.url).toBeUndefined();
    expect(schema['@id']).toBeUndefined();
  });
});
