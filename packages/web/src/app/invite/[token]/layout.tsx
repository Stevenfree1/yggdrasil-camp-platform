import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.invite;

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
