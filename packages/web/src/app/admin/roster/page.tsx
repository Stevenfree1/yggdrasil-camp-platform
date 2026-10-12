'use client';

/**
 * /admin/roster merged into /admin/members. This stub keeps old
 * bookmarks and deep links (e.g. ?search=<email>) working.
 */

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RosterRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/admin/members${qs ? `?${qs}` : ''}`);
  }, [router, searchParams]);

  return null;
}

export default function RosterPage() {
  return (
    <Suspense fallback={null}>
      <RosterRedirect />
    </Suspense>
  );
}
