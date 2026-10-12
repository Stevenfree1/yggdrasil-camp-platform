import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.members;

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="member-area">{children}</div>;
}
