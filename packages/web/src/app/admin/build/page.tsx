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
  Hammer,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { StatCard } from '../../../components/shared/StatCard';
import { EmptyState } from '../../../components/shared/EmptyState';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import {
  type BuildDayDTO,
  type BuildSummary,
  type BuildAssignmentDTO,
  fetchBuild,
  fetchBuildSummary,
  upsertBuildDay,
  deleteBuildDay,
  assignBuildMember,
  unassignBuildMember,
  updateBuildAssignment,
} from '../../../lib/adminApi';
import AssignMemberAutocomplete from '../../../components/admin/AssignMemberAutocomplete';
import { formatDayLong, fromDateInputValue, toDateInputValue } from '../../../lib/dates';

const MIN_PER_DAY = 5;
const KNOWN_TEAMS = ['kitchen', 'shade', 'plumbing', 'electricity', 'infrastructure', 'art car'];



export default function BuildPage() {
  const { selectedSeasonId, selectedSeason } = useAdminSeason();

  const [days, setDays] = useState<BuildDayDTO[]>([]);
  const [summary, setSummary] = useState<BuildSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);

  // create/edit day modal
  const [dayModal, setDayModal] = useState<{ id?: string; date: string; name: string; notes: string } | null>(null);
  const [dayMutating, setDayMutating] = useState(false);

  // edit assignment inline
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editTeam, setEditTeam] = useState('');
  const [editTicket, setEditTicket] = useState('');

  // delete confirm
  const [deleteDay, setDeleteDay] = useState<BuildDayDTO | null>(null);
  const [removeAssignment, setRemoveAssignment] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!selectedSeasonId) return;
    try {
      setLoading(true);
      const [list, sum] = await Promise.all([
        fetchBuild(selectedSeasonId),
        fetchBuildSummary(selectedSeasonId),
      ]);
      setDays(list.buildDays || []);
      setSummary(sum);
      if (!activeDayId && list.buildDays.length > 0) setActiveDayId(list.buildDays[0].id);
      setError(null);
    } catch {
      setError('Unable to load build data.');
      setDays([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId, activeDayId]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset activeDay if no longer present
  useEffect(() => {
    if (activeDayId && !days.find((d) => d.id === activeDayId)) {
      setActiveDayId(days[0]?.id || null);
    }
  }, [days, activeDayId]);

  const activeDay = useMemo(() => days.find((d) => d.id === activeDayId) || null, [days, activeDayId]);

  // ─── handlers ────────────────────────────────────────────────────────────

  const handleSaveDay = async () => {
    if (!dayModal) return;
    if (!dayModal.date || !dayModal.name) return;
    if (!selectedSeasonId) return;
    setDayMutating(true);
    try {
      await upsertBuildDay({
        id: dayModal.id,
        seasonId: selectedSeasonId,
        // noon UTC: a date-only value that cannot shift a day in any timezone
        date: fromDateInputValue(dayModal.date)?.toISOString() ?? '',
        name: dayModal.name,
        notes: dayModal.notes || null,
      });
      setDayModal(null);
      await load();
    } catch {
      // silently fail
    } finally {
      setDayMutating(false);
    }
  };

  const handleDeleteDay = async () => {
    if (!deleteDay) return;
    try {
      await deleteBuildDay(deleteDay.id);
      setDeleteDay(null);
      if (activeDayId === deleteDay.id) setActiveDayId(null);
      await load();
    } catch {
      // silently fail
    }
  };

  const handleAssign = async (sm: { id: string }) => {
    if (!activeDay) return;
    try {
      await assignBuildMember({ buildDayId: activeDay.id, seasonMemberId: sm.id });
      await load();
    } catch {
      // silently fail
    }
  };

  const handleUnassign = async () => {
    if (!removeAssignment) return;
    try {
      await unassignBuildMember(removeAssignment.id);
      setRemoveAssignment(null);
      await load();
    } catch {
      // silently fail
    }
  };

  const handleSaveEdit = async (a: BuildAssignmentDTO) => {
    try {
      await updateBuildAssignment({
        id: a.id,
        team: editTeam || null,
        wapTicketId: editTicket || null,
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
          <h1 className="text-display-thin text-3xl text-ink">Build Week</h1>
          <p className="text-body-relaxed text-sm text-ink-soft mt-1">
            Plan and assign builders to build days
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
            onClick={() =>
              setDayModal({ date: '', name: '', notes: '' })
            }
            className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Build Day</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Calendar} label="Build Days" value={days.length} index={0} />
        <StatCard icon={Users} label="Total Assignments" value={totalAssignments} index={1} />
        <StatCard
          icon={AlertTriangle}
          label="Underfilled Days"
          value={underfilledCount}
          subtext={`< ${MIN_PER_DAY} builders`}
          index={2}
        />
        <StatCard
          icon={CheckCircle2}
          label="Avg per day"
          value={days.length > 0 ? Math.round(totalAssignments / days.length) : 0}
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
          <p className="text-sm text-ink-soft">Loading build schedule...</p>
        </div>
      ) : days.length === 0 ? (
        <EmptyState
          icon={Hammer}
          title="No Build Days Yet"
          description="Add a build day (e.g. Tuesday, Friday) to start assigning members."
          action={{ label: 'Add Build Day', onClick: () => setDayModal({ date: '', name: '', notes: '' }) }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Day list (left column) */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-display-thin text-xs uppercase tracking-wider text-ink-soft">
              Build Days ({days.length})
            </h3>
            {days.map((d) => {
              const isActive = d.id === activeDayId;
              const underfilled = d.assignmentCount < MIN_PER_DAY;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveDayId(d.id)}
                  className={`w-full luxury-card p-4 text-left transition-all ${
                    isActive ? 'ring-2 ring-gold' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{d.name}</p>
                      <p className="text-xs text-ink-soft mt-0.5">{formatDayLong(d.date)}</p>
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
                      Needs builders
                    </p>
                  )}
                </button>
              );
            })}

            {/* Team Totals card */}
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

          {/* Day detail (right column) */}
          <div className="lg:col-span-2">
            {activeDay ? (
              <motion.div
                key={activeDay.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="luxury-card p-6 space-y-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-display-thin text-xl text-ink">{activeDay.name}</h2>
                    <p className="text-body-relaxed text-sm text-ink-soft mt-1">
                      {formatDayLong(activeDay.date)} · {activeDay.assignmentCount} assigned
                    </p>
                    {activeDay.notes && (
                      <p className="text-xs text-ink-soft mt-2">{activeDay.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setDayModal({
                          id: activeDay.id,
                          date: toDateInputValue(activeDay.date),
                          name: activeDay.name,
                          notes: activeDay.notes || '',
                        })
                      }
                      className="p-2 rounded-lg text-ink-soft hover:text-gold hover:bg-cream transition-colors"
                      title="Edit day"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteDay(activeDay)}
                      className="p-2 rounded-lg text-ink-soft hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete day"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Assign autocomplete */}
                <div>
                  <label className="form-label">Assign Member</label>
                  <AssignMemberAutocomplete
                    seasonId={selectedSeasonId}
                    excludeSeasonMemberIds={activeDay.assignments.map((a) => a.seasonMemberId)}
                    onSelect={handleAssign}
                    placeholder="Search members to assign to this build day..."
                  />
                </div>

                {/* Assignment list */}
                <div>
                  <h3 className="text-display-thin text-xs uppercase tracking-wider text-ink-soft mb-3">
                    Assigned Builders ({activeDay.assignments.length})
                  </h3>
                  {activeDay.assignments.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-tan/30 rounded-xl">
                      <Users className="h-8 w-8 text-ink-soft/30 mx-auto mb-2" />
                      <p className="text-sm text-ink-soft">No builders assigned yet.</p>
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
                                      list="known-teams"
                                      type="text"
                                      value={editTeam}
                                      onChange={(e) => setEditTeam(e.target.value)}
                                      placeholder="Team (kitchen, shade, ...)"
                                      className="form-input text-xs py-1 px-2 max-w-[180px]"
                                    />
                                    <datalist id="known-teams">
                                      {KNOWN_TEAMS.map((t) => (
                                        <option key={t} value={t} />
                                      ))}
                                    </datalist>
                                    <input
                                      type="text"
                                      value={editTicket}
                                      onChange={(e) => setEditTicket(e.target.value)}
                                      placeholder="WAP / ticket ID"
                                      className="form-input text-xs py-1 px-2 max-w-[160px]"
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
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {a.team && (
                                      <span className="inline-flex items-center rounded-full bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 text-[10px] font-medium capitalize">
                                        {a.team}
                                      </span>
                                    )}
                                    {a.wapTicketId && (
                                      <span className="inline-flex items-center rounded-full bg-sage/10 text-sage border border-sage/20 px-2 py-0.5 text-[10px] font-medium">
                                        WAP {a.wapTicketId}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {!isEditing && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingAssignmentId(a.id);
                                    setEditTeam(a.team || '');
                                    setEditTicket(a.wapTicketId || '');
                                  }}
                                  className="p-1 rounded text-ink-soft/40 hover:text-gold hover:bg-cream transition-colors"
                                  title="Edit team/ticket"
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
                <p className="text-sm text-ink-soft">Select a build day to view assignments.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Day modal */}
      <AnimatePresence>
        {dayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDayModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative luxury-card p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-display-thin text-xl text-ink">
                  {dayModal.id ? 'Edit Build Day' : 'Add Build Day'}
                </h2>
                <button
                  onClick={() => setDayModal(null)}
                  className="p-1 rounded-lg hover:bg-cream transition-colors"
                >
                  <X className="h-5 w-5 text-ink-soft" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="form-label">
                    Day Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={dayModal.name}
                    onChange={(e) => setDayModal({ ...dayModal, name: e.target.value })}
                    placeholder="e.g. Tuesday Build, Friday Build"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dayModal.date}
                    onChange={(e) => setDayModal({ ...dayModal, date: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <textarea
                    value={dayModal.notes}
                    onChange={(e) => setDayModal({ ...dayModal, notes: e.target.value })}
                    placeholder="Optional notes about this build day..."
                    className="form-input min-h-[80px] resize-y"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setDayModal(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDay}
                    disabled={dayMutating || !dayModal.name || !dayModal.date}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {dayMutating && <Loader2 className="h-4 w-4 animate-spin" />}
                    {dayModal.id ? 'Save' : 'Create Day'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteDay}
        onClose={() => setDeleteDay(null)}
        onConfirm={handleDeleteDay}
        title="Delete Build Day"
        message={`Delete "${deleteDay?.name}"? This will also remove all ${deleteDay?.assignmentCount ?? 0} assignments. This action cannot be undone.`}
        confirmLabel="Delete Day"
        variant="danger"
      />

      <ConfirmDialog
        open={!!removeAssignment}
        onClose={() => setRemoveAssignment(null)}
        onConfirm={handleUnassign}
        title="Remove Builder"
        message={`Remove ${removeAssignment?.name} from this build day?`}
        confirmLabel="Remove"
        variant="warning"
      />
    </div>
  );
}
