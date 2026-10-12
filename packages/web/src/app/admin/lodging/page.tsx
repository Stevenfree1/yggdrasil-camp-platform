'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const LodgingEditor = dynamic(
  () => import('../../../components/lodging/LodgingEditor').then((m) => m.LodgingEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-2 p-8 text-ink/60">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading canvas…
      </div>
    ),
  },
);

export default function AdminLodgingPage() {
  return <LodgingEditor />;
}
