'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const PortalLodgingView = dynamic(
  () => import('../../../components/lodging/PortalLodgingView').then((m) => m.PortalLodgingView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-2 p-8 text-ink/80">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading map…
      </div>
    ),
  },
);

export default function PortalLodgingPage() {
  return <PortalLodgingView />;
}
