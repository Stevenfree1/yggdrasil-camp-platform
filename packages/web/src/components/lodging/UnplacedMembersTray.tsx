'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, UserPlus, Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';

interface UnplacedMember {
  id: string;
  housingType: string | null;
  housingSize: string | null;
  gridPower: string;
  status: string;
  member: { id: string; name: string; playaName: string | null };
}

interface Props {
  members: UnplacedMember[];
  selectedUnitId: string | null;
  onAssigned: () => void;
}

/**
 * Bottom tray showing confirmed members without a lodging unit.
 * Each row has a "Place here" button that assigns the member to the currently-selected
 * unit (or shows a hint if none is selected).
 */
export function UnplacedMembersTray({ members, selectedUnitId, onAssigned }: Props) {
  const [open, setOpen] = useState(true);
  const assign = trpc.lodging.assignMember.useMutation({
    onSuccess: () => onAssigned(),
  });

  if (members.length === 0) {
    return (
      <div className="luxury-card p-3 text-sm text-ink/60 flex items-center gap-2">
        <Users className="w-4 h-4" /> Everyone confirmed has a unit. ✨
      </div>
    );
  }

  return (
    <div className="luxury-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-cream/40"
      >
        <span className="font-display text-ink inline-flex items-center gap-2">
          <Users className="w-4 h-4 text-sage" />
          Unplaced ({members.length})
        </span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
            {members.map((m) => {
              const placeBtnDisabled = !selectedUnitId || assign.isPending;
              const handleDragStart = (e: React.DragEvent) => {
                e.dataTransfer.setData('application/x-camp-member', m.id);
                e.dataTransfer.effectAllowed = 'copy';
              };
              return (
                <div
                  key={m.id}
                  draggable
                  onDragStart={handleDragStart}
                  className="flex items-center justify-between gap-1.5 bg-cream/40 px-2 py-1 rounded text-xs cursor-grab active:cursor-grabbing hover:bg-cream/70"
                  title="Drag onto the canvas to create a unit, or click + to place in selected unit"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-ink truncate">
                      {m.member.playaName ?? m.member.name}
                    </div>
                    <div className="text-ink/50 truncate">
                      {[m.housingType, m.housingSize, m.gridPower !== 'NONE' ? m.gridPower.replace('AMP_', '') + 'A' : null]
                        .filter(Boolean)
                        .join(' · ') || m.member.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      selectedUnitId &&
                      assign.mutate({ lodgingUnitId: selectedUnitId, seasonMemberId: m.id })
                    }
                    disabled={placeBtnDisabled}
                    className="shrink-0 text-sage hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed"
                    title={selectedUnitId ? 'Place in selected unit' : 'Select a unit first, or drag onto canvas'}
                  >
                    {assign.isPending &&
                    (assign.variables as { seasonMemberId?: string } | undefined)?.seasonMemberId === m.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <UserPlus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
          {!selectedUnitId && (
            <div className="text-xs text-ink/40 italic mt-2">
              Tip: drag a member card onto the canvas to drop a unit there with their housingType
              dimensions, or click a unit then the + to place them in an existing unit.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
