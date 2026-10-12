'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Users,
  UserMinus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { StatCard } from '../../../components/shared/StatCard';
import { EmptyState } from '../../../components/shared/EmptyState';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import {
  type StrikeDayDTO,
  type StrikeSummary,
  type StrikeAssignmentDTO,
  fetchStrike,
  fetchStrikeSummary,
  assignStrikeMember,
  unassignStrikeMember,
  updateStrikeAssignment,
} from '../../../lib/adminApi';
import AssignMemberAutocomplete from '../../../components/admin/AssignMemberAutocomplete';
import { formatDayLong, formatDateOnly, fromDateInputValue } from '../../../lib/dates';

const MIN_PER_DAY = 3;
const KNOWN_TEAMS = [
  'moop sweep',
  'kitchen breakdown',
  'shade breakdown',
  'LA caravan',
  'Reno storage',
  'trash run',
  'pack-out',
];



export default function StrikePage() {
  const { selectedSeasonId, selectedSeason } = useAdminSeason();

  const [strikeDays, setStrikeDays] = useState<StrikeDayDTO[]>([]);
  const [summary, setSummary] = useState<StrikeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Add new departure day
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDate, setNewDate] = useState('');

  // Edit assignment inline
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editTeam, setEditTeam] = useState('');
  const [editDate, setEditDate] = useState('');

  // Remove confirm
  const [removeAssignment, setRemoveAssignment] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!selectedSeasonId) return;
    try {
      setLoading(true);
      const [list, sum] = await Promise.all([
        fetchStrike(selectedSeasonId),
        fetchStrikeSummary(selectedSeasonId),
      ]);
      setStrikeDays(list.strikeDays || []);
      setSummary(sum);
      if (!activeKey && list.strikeDays.length > 0) setActiveKey(list.strikeDays[0].key);
      setError(null);
    } catch {
      setError('Unable to load strike data.');
      setStrikeDays([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId, activeKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeKey && !strikeDays.find((d) => d.key === activeKey)) {
      setActiveKey(strikeDays[0]?.key || null);
    }
  }, [strikeDays, activeKey]);

  const activeDay = useMemo(() => strikeDays.find((d) => d.key === activeKey) || null, [strikeDays, activeKey]);

  // ─── handlers ────────────────────────────────────────────────────────────

  // "Add Departure Day" just opens the autocomplete with a pre-set date —
  // we use the active day's date when assigning, or the modal-entered date.
  const handleAddDay = () => {
    if (!newDate) return;
    // Push a synthetic day into local state if no assignments exist yet
    const isoDay = fromDateInputValue(newDate)?.toISOString() ?? '';
    if (!isoDay) return;
    const key = isoDay.slice(0, 10);
    if (!strikeDays.find((d) => d.key === key)) {
      setStrikeDays((prev) => [
        ...prev,
        {
          key,
          date: isoDay,
          label: new Date(isoDay).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          }),
          assignmentCount: 0,
          assignments: [],
        },
      ].sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }));
    }
    setActiveKey(key);
    setShowAddDay(false);
    setNewDate('');
  };

  const handleAssign = async (sm: { id: string }) => {
    if (!activeDay) return;
    try {
      await assignStrikeMember({
        seasonId: selectedSeasonId ?? undefined,
        seasonMemberId: sm.id,
        departureDate: activeDay.date,
      });
      await load();
    } catch {
      // silently fail
    }
  };

  const handleUnassign = async () => {
    if (!removeAssignment) return;
    try {
      await unassignStrikeMember(removeAssignment.id);
      setRemoveAssignment(null);
      await load();
    } catch {
      // silently fail
    }
  };

  const handleSaveEdit = async (a: StrikeAssignmentDTO) => {
    try {
      await updateStrikeAssignment({
        id: a.id,
        team: editTeam || null,
        departureDate: editDate ? new Date(editDate + 'T12:00:00Z').toISOString() : null,
      });
      setEditingAssignmentId(null);
      await load();
    } catch {
      // silently fail
    }
  };

  // ─── render ──────────────────────────────────────────────────────────────

  const totalAssignments = summary?.totalAssignments ?? 0;
  const underfilledCount = summary?.underfilledCount ?? 0;
  const teamTotals = summary?.teamTotals ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display-thin text-3xl text-ink">Strike Crew</h1>
          <p className="text-body-relaxed text-sm text-ink-soft mt-1">
            Plan tear-down crew assignments by departure day
            {selectedSeason ? ` for ${selectedSeason.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddDay(true)}
            className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Departure Day</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Calendar} label="Departure Days" value={strikeDays.length} index={0} />
        <StatCard icon={Users} label="Total Crew" value={totalAssignments} index={1} />
        <StatCard
          icon={AlertTriangle}
          label="Underfilled Days"
          value={underfilledCount}
          subtext={`< ${MIN_PER_DAY} crew`}
          index={2}
        />
        <StatCard
          icon={CheckCircle2}
          label="Avg per day"
          value={strikeDays.length > 0 ? Math.round(totalAssignments / strikeDays.length) : 0}
          index={3}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Loading strike schedule...</p>
        </div>
      ) : strikeDays.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="No Strike Days Yet"
          description="Add a departure day to start assigning crew."
          action={{ label: 'Add Departure Day', onClick: () => setShowAddDay(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Day list */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-display-thin text-xs uppercase tracking-wider text-ink-soft">
              Departure Days ({strikeDays.length})
            </h3>
            {strikeDays.map((d) => {
              const isActive = d.key === activeKey;
              const underfilled = d.assignmentCount < MIN_PER_DAY;
              return (
                <button
                  key={d.key}
                  onClick={() => setActiveKey(d.key)}
                  className={`w-full luxury-card p-4 text-left transition-all ${
                    isActive ? 'ring-2 ring-gold' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{d.label}</p>
                      {d.date && (
                        <p className="text-xs text-ink-soft mt-0.5">
                          {formatDateOnly(d.date)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Users className="h-3.5 w-3.5 text-ink-soft" />
                      <span
                        className={`text-sm font-medium tabular-nums ${
                          underfilled ? 'text-amber-600' : 'text-ink'
                        }`}
                      >
                        {d.assignmentCount}
                      </span>
                    </div>
                  </div>
                  {underfilled && (
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-amber-600 inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Needs crew
                    </p>
                  )}
                </button>
              );
            })}

            {Object.keys(teamTotals).length > 0 && (
              <div className="luxury-card p-4 mt-4">
                <h4 className="text-display-thin text-xs uppercase tracking-wider text-ink-soft mb-3">
                  Team Totals
                </h4>
                <ul className="space-y-1.5">
                  {Object.entries(teamTotals)
                    .sort((a, b) => b[1] - a[1])
                    .map(([team, count]) => (
                      <li key={team} className="flex items-center justify-between text-sm">
                        <span className="text-ink-soft capitalize">{team}</span>
                        <span className="font-medium text-ink tabular-nums">{count}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          {/* Day detail */}
          <div className="lg:col-span-2">
            {activeDay ? (
              <motion.div
                key={activeDay.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="luxury-card p-6 space-y-5"
              >
                <div>
                  <h2 className="text-display-thin text-xl text-ink">{activeDay.label}</h2>
                  <p className="text-body-relaxed text-sm text-ink-soft mt-1">
                    {formatDayLong(activeDay.date)} · {activeDay.assignmentCount} on crew
                  </p>
                </div>

                <div>
                  <label className="form-label">Assign Crew Member</label>
                  <AssignMemberAutocomplete
                    seasonId={selectedSeasonId}
                    excludeSeasonMemberIds={activeDay.assignments.map((a) => a.seasonMemberId)}
                    onSelect={handleAssign}
                    placeholder="Search members to add to strike crew..."
                  />
                  <p className="text-[11px] text-ink-soft mt-1">
                    Members can only have one strike assignment per season. Reassigning will move them to this day.
                  </p>
                </div>

                <div>
                  <h3 className="text-display-thin text-xs uppercase tracking-wider text-ink-soft mb-3">
                    Strike Crew ({activeDay.assignments.length})
                  </h3>
                  {activeDay.assignments.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-tan/30 rounded-xl">
                      <Users className="h-8 w-8 text-ink-soft/30 mx-auto mb-2" />
                      <p className="text-sm text-ink-soft">No crew assigned to this day yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeDay.assignments.map((a) => {
                        const isEditing = editingAssignmentId === a.id;
                        return (
                          <div
                            key={a.id}
                            className="flex items-center justify-between rounded-xl border border-tan/30 p-3 hover:bg-cream/50 transition-colors gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
                                <span className="text-xs font-medium text-sage">
                                  {a.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-ink truncate">{a.name}</p>
                                <p className="text-xs text-ink-soft truncate">
                                  {a.email}
                                  {a.playaName ? ` · "${a.playaName}"` : ''}
                                </p>
                                {isEditing ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <input
                                      list="known-strike-teams"
                                      type="text"
                                      value={editTeam}
                                      onChange={(e) => setEditTeam(e.target.value)}
                                      placeholder="Team / role"
                                      className="form-input text-xs py-1 px-2 max-w-[200px]"
                                    />
                                    <datalist id="known-strike-teams">
                                      {KNOWN_TEAMS.map((t) => (
                                        <option key={t} value={t} />
                                      ))}
                                    </datalist>
                                    <input
                                      type="date"
                                      value={editDate}
                                      onChange={(e) => setEditDate(e.target.value)}
                                      className="form-input text-xs py-1 px-2"
                                    />
                                    <button
                                      onClick={() => handleSaveEdit(a)}
                                      className="px-2 py-1 text-xs font-medium bg-sage text-white rounded-lg hover:bg-sage/90 transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingAssignmentId(null)}
                                      className="px-2 py-1 text-xs text-ink-soft hover:text-ink transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  a.team && (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center rounded-full bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 text-[10px] font-medium capitalize">
                                        {a.team}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                            {!isEditing && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingAssignmentId(a.id);
                                    setEditTeam(a.team || '');
                                    setEditDate(activeDay.date ? activeDay.date.slice(0, 10) : '');
                                  }}
                                  className="p-1 rounded text-ink-soft/40 hover:text-gold hover:bg-cream transition-colors"
                                  title="Edit team / date"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setRemoveAssignment({ id: a.id, name: a.name })}
                                  className="p-1 rounded text-ink-soft/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="Remove"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="luxury-card p-8 text-center">
                <Calendar className="h-10 w-10 text-ink-soft/30 mx-auto mb-3" />
                <p className="text-sm text-ink-soft">Select a departure day to view crew.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add departure day modal */}
      <AnimatePresence>
        {showAddDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowAddDay(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative luxury-card p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-display-thin text-xl text-ink">Add Departure Day</h2>
                <button
                  onClick={() => setShowAddDay(false)}
                  className="p-1 rounded-lg hover:bg-cream transition-colors"
                >
                  <X className="h-5 w-5 text-ink-soft" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="form-label">
                    Departure Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="form-input"
                  />
                  <p className="text-[11px] text-ink-soft mt-1">
                    This creates an empty bucket for the day. Members get added by assigning crew below.
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowAddDay(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddDay}
                    disabled={!newDate}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add Day
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!removeAssignment}
        onClose={() => setRemoveAssignment(null)}
        onConfirm={handleUnassign}
        title="Remove Crew Member"
        message={`Remove ${removeAssignment?.name} from this strike day?`}
        confirmLabel="Remove"
        variant="warning"
      />
    </div>
  );
}
