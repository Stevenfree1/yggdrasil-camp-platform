'use client';

import { useState, useMemo } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { parseLodgingCsv } from './csv';

interface Props {
  seasonId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const SAMPLE = `memberName,kind,label,w,h,x,y,rotation,partnerCamp
Jamie Rivera,RV,Kodiak-1,8,25,12,12,0,
Sam Okafor,TENT,,10,12,24,12,0,
,STRUCTURE,Kitchen,16,16,40,12,0,
,STRUCTURE,Main Dome,20,30,0,40,0,Neighbor Camp
,STREET_LABEL,"9:00 & F",12,4,30,0,0,
,BOUNDARY,,80,4,0,80,0,`;

export function CsvImportModal({ seasonId, open, onClose, onImported }: Props) {
  const [text, setText] = useState('');
  const importCsv = trpc.lodging.importCsv.useMutation({
    onSuccess: () => {
      onImported();
      onClose();
      setText('');
    },
  });

  const parsed = useMemo(() => (text.trim() ? parseLodgingCsv(text) : null), [text]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!parsed || parsed.rows.length === 0) return;
    importCsv.mutate({
      seasonId,
      rows: parsed.rows.map(({ lineNum: _l, ...rest }) => rest),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="luxury-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-ink inline-flex items-center gap-2">
            <Upload className="w-5 h-5 text-gold" />
            Import units from CSV
          </h2>
          <button onClick={onClose} className="text-ink/60 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-ink/70 mb-2">
          Paste CSV with columns:{' '}
          <code className="text-xs bg-cream/60 px-1 py-0.5 rounded">
            memberName, kind, label, w, h, x, y, rotation, partnerCamp
          </code>
          . Required: <code>kind, w, h, x, y</code>. Rows with a matching memberName auto-assign.
        </div>

        <details className="text-xs text-ink/60 mb-3">
          <summary className="cursor-pointer hover:text-ink">Show example</summary>
          <pre className="mt-2 bg-cream/40 p-2 rounded text-[11px] overflow-x-auto">{SAMPLE}</pre>
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="mt-1 text-gold hover:underline"
          >
            Load example into form
          </button>
        </details>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="form-input font-mono text-xs"
          placeholder="memberName,kind,label,w,h,x,y,rotation,partnerCamp..."
        />

        {parsed && (
          <div className="mt-2 text-sm">
            {parsed.errors.length > 0 ? (
              <div className="text-red-700 inline-flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <ul className="space-y-0.5">
                  {parsed.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            ) : (
              <div className="text-sage">
                Ready to import {parsed.rows.length} unit{parsed.rows.length === 1 ? '' : 's'}.
              </div>
            )}
          </div>
        )}

        {importCsv.data && (
          <div className="mt-3 text-sm text-ink/80 bg-cream/40 p-2 rounded">
            Imported {importCsv.data.created} units · assigned {importCsv.data.assigned} members.
            {importCsv.data.unmatched.length > 0 && (
              <div className="mt-1 text-amber-700">
                Could not match: {importCsv.data.unmatched.join(', ')}
              </div>
            )}
          </div>
        )}

        {importCsv.error && (
          <div className="mt-3 text-sm text-red-700">Import failed: {importCsv.error.message}</div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="cta-secondary text-sm px-3 py-1.5">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!parsed || parsed.rows.length === 0 || parsed.errors.length > 0 || importCsv.isPending}
            className="cta-primary text-sm px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {importCsv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
