import {
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateBreadcrumbSchema,
  generateWebPageSchema,
  generateFAQPageSchema,
} from '@/lib/metadata';

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Root-level JSON-LD: Organization and WebSite schema.
 * Included in the root layout so every page carries the org data.
 */
export function StructuredData() {
  return (
    <>
      <JsonLd data={generateOrganizationSchema()} />
      <JsonLd data={generateWebSiteSchema()} />
    </>
  );
}

/**
 * Breadcrumb JSON-LD for individual pages.
 */
export function BreadcrumbStructuredData({
  items,
}: {
  items: Array<{ name: string; path: string }>;
}) {
  return <JsonLd data={generateBreadcrumbSchema(items)} />;
}

/**
 * WebPage JSON-LD for standard content pages.
 */
export function WebPageStructuredData(props: {
  name: string;
  description: string;
  path: string;
  dateModified?: string;
}) {
  return <JsonLd data={generateWebPageSchema(props)} />;
}

/**
 * FAQPage JSON-LD helper. Pass an array of {question, answer} pairs.
 */
export function FAQPageStructuredData(props: {
  questions: Array<{ question: string; answer: string }>;
  path?: string;
}) {
  return <JsonLd data={generateFAQPageSchema(props)} />;
}
