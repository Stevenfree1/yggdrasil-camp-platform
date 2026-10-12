import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.register;

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
