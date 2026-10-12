import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.resetPassword;

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
