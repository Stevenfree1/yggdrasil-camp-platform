import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.forgotPassword;

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
