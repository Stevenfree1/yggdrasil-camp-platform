import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.apply;

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
