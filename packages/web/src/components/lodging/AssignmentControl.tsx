'use client';

import { useState, useMemo } from 'react';
import { UserPlus, X, Loader2, Search } from 'lucide-react';
import { trpc } from '../../lib/trpc';

interface Occupant {
  id: string; // seasonMember.id
  name: string;
  playaName: string | null;
}

interface Props {
  seasonId: string;
  lodgingUnitId: string;
  occupants: Occupant[];
  onChanged: () => void; // called after assign/unassign to trigger refetch
}

/**
 * Embedded inside UnitPropertiesPanel via the assignmentSlot prop.
 * Lists current occupants with unassign buttons, and exposes a typeahead
 * to pick a SeasonMember to assign to this unit.
 */
export function AssignmentControl({ seasonId, lodgingUnitId, occupants, onChanged }: Props) {
  const [query, setQuery] = useState('');
  const search = trpc.lodging.searchMembers.useQuery(
    { seasonId, query: query.trim().length >= 2 ? query : undefined },
    { enabled: !!seasonId },
  );
  const assign = trpc.lodging.assignMember.useMutation({ onSuccess: () => onChanged() });
  const unassign = trpc.lodging.unassignMember.useMutation({ onSuccess: () => onChanged() });

  const filtered = useMemo(() => {
    if (!search.data) return [];
    const occupantIds = new Set(occupants.map((o) => o.id));
    return search.data.filter((row) => !occupantIds.has(row.id)).slice(0, 8);
  }, [search.data, occupants]);

  return (
    <div className="space-y-2">
      <label className="form-label inline-flex items-center gap-1.5">
        <UserPlus className="w-3.5 h-3.5" />
        Members
      </label>

      {occupants.length === 0 && (
        <div className="text-xs text-ink/50 italic">No one assigned yet.</div>
      )}

      {occupants.map((o) => (
        <div key={o.id} className="flex items-center justify-between gap-2 text-sm bg-cream/40 px-2 py-1.5 rounded">
          <span className="text-ink">
            {o.playaName ? `${o.playaName}` : o.name}
            {o.playaName && <span className="text-ink/50 text-xs"> · {o.name}</span>}
          </span>
          <button
            type="button"
            onClick={() => unassign.mutate({ seasonMemberId: o.id })}
            disabled={unassign.isPending}
            className="text-ink/50 hover:text-red-700"
            aria-label={`Unassign ${o.name}`}
            title="Remove from unit"
          >
            {unassign.isPending &&
            (unassign.variables as { seasonMemberId?: string } | undefined)?.seasonMemberId === o.id
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <X className="w-3.5 h-3.5" />}
          </button>
        </div>
      ))}

      <div className="relative mt-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/40 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search to add member…"
          className="form-input pl-7 text-sm"
        />
      </div>

      {query.trim().length >= 2 && (
        <div className="border border-warm-border rounded max-h-56 overflow-y-auto bg-cream/40">
          {search.isLoading && (
            <div className="p-2 text-xs text-ink/50 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Searching…
            </div>
          )}
          {!search.isLoading && filtered.length === 0 && (
            <div className="p-2 text-xs text-ink/50">No matches.</div>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                assign.mutate({ lodgingUnitId, seasonMemberId: m.id });
                setQuery('');
              }}
              className="w-full text-left p-2 text-sm hover:bg-cream border-b border-warm-border/40 last:border-0"
            >
              <div className="font-medium text-ink">
                {m.member.playaName ?? m.member.name}
                {m.member.playaName && <span className="text-ink/50 text-xs"> · {m.member.name}</span>}
              </div>
              <div className="text-xs text-ink/60 flex gap-2">
                {m.housingType && <span>{m.housingType}</span>}
                {m.gridPower !== 'NONE' && <span>{m.gridPower.replace('AMP_', '')}A</span>}
                {m.lodgingAssignment && (
                  <span className="text-amber-700">already placed</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {assign.error && (
        <div className="text-xs text-red-700">Assign failed: {assign.error.message}</div>
      )}
    </div>
  );
}
