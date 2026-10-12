'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { setMemberAdminScopes } from '../../lib/adminApi';
import type { AdminScope } from '../../contexts/AuthContext';

const SCOPES: { value: AdminScope; label: string; blurb: string }[] = [
  {
    value: 'INVENTORY',
    label: 'Inventory',
    blurb: 'Add and edit inventory items, archive rows. Cannot delete.',
  },
  {
    value: 'SHIFTS',
    label: 'Shifts',
    blurb: 'Create shifts and assign members. Sees the season roster.',
  },
];

interface Props {
  memberId: string;
  memberName: string;
  initialScopes: AdminScope[];
  /** Only a LEAD may grant scopes; the server enforces this too. */
  canEdit: boolean;
  onSaved?: (scopes: AdminScope[]) => void;
}

/**
 * Per-area admin grants for one member. Scopes are additive on top of role —
 * a LEAD or MANAGER already reaches these areas, so this card only changes
 * anything for members below that.
 */
export function AdminScopesCard({
  memberId,
  memberName,
  initialScopes,
  canEdit,
  onSaved,
}: Props) {
  const [scopes, setScopes] = useState<AdminScope[]>(initialScopes);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    scopes.length !== initialScopes.length ||
    scopes.some((s) => !initialScopes.includes(s));

  const toggle = (scope: AdminScope) => {
    setSaved(false);
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await setMemberAdminScopes(memberId, scopes);
      setSaved(true);
      onSaved?.(scopes);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save scopes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="luxury-card p-5">
      <h3 className="font-display text-lg text-ink inline-flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-gold" />
        Area access
      </h3>
      <p className="mt-1 text-sm text-ink/60">
        Give {memberName.split(' ')[0]} admin access to specific areas without making
        them a manager or lead.
      </p>

      <div className="mt-4 space-y-2">
        {SCOPES.map((s) => (
          <label
            key={s.value}
            className={`flex gap-3 rounded border p-3 ${
              canEdit ? 'cursor-pointer hover:bg-cream/60' : 'opacity-70'
            } ${scopes.includes(s.value) ? 'border-gold/60 bg-gold/5' : 'border-warm-border'}`}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={scopes.includes(s.value)}
              disabled={!canEdit || saving}
              onChange={() => toggle(s.value)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{s.label}</span>
              <span className="block text-xs text-ink/60">{s.blurb}</span>
            </span>
          </label>
        ))}
      </div>

      {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

      {canEdit && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="cta-primary inline-flex items-center gap-2 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save access
          </button>
          {saved && !dirty && <span className="text-sm text-sage">Saved</span>}
        </div>
      )}
    </div>
  );
}
