'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Users,
  Zap,
  ArrowRight,
  X,
  Settings,
} from 'lucide-react';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { EmptyState } from '../../../components/shared/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Season {
  id: string;
  year: number;
  name: string;
  isActive: boolean;
  duesAmountCents?: number;
  gridFee30ACents?: number;
  gridFee50ACents?: number;
  startDate?: string;
  endDate?: string;
  buildStartDate?: string;
  strikeEndDate?: string;
  _count?: { seasonMembers: number };
  memberCount?: number;
}

interface RolloverResult {
  season: Season;
  membersEnrolled: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------


import { trpcQuery, trpcMutation } from '../../../lib/adminApi';
import { formatDateOnly } from '../../../lib/dates';
import { TravelSummaryCard } from '../../../components/admin/TravelSummaryCard';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SeasonManagementPage() {
  const { seasons: contextSeasons, selectedSeasonId } = useAdminSeason();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Activate confirm
  const [activateConfirm, setActivateConfirm] = useState<string | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);

  // Rollover wizard
  const [showRollover, setShowRollover] = useState(false);

  const loadSeasons = useCallback(async () => {
    try {
      setLoading(true);
      const result = await trpcQuery<Season[]>('seasons.list');
      setSeasons(Array.isArray(result) ? result : []);
      setError(null);
    } catch {
      setError('Unable to load seasons. The server may not be running.');
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSeasons();
  }, [loadSeasons]);

  const showNotif = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleActivate = async (seasonId: string) => {
    try {
      setActivateLoading(true);
      await trpcMutation('seasons.activate', { seasonId });
      await loadSeasons();
      showNotif('Season activated successfully.', 'success');
    } catch {
      showNotif('Failed to activate season.', 'error');
    } finally {
      setActivateLoading(false);
      setActivateConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display-thin text-3xl text-ink">Seasons</h1>
          <p className="text-body-relaxed text-sm text-ink-soft mt-1">
            Manage camp seasons, create new ones, or roll over members.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSeasons}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowRollover(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gold/40 text-gold hover:bg-gold/5 transition-colors"
          >
            <Zap className="h-4 w-4" />
            Rollover
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Season
          </button>
        </div>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-3 ${
              notification.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0" />
            )}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Travel roll-up for the active season (empty state doubles as the
          reminder that a nudge email is the next move) */}
      <TravelSummaryCard />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
          <button
            onClick={loadSeasons}
            className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Loading seasons...</p>
        </div>
      ) : seasons.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Seasons"
          description="No seasons have been created yet. Create your first season to get started."
          action={{ label: 'Create Season', onClick: () => setShowCreate(true) }}
        />
      ) : (
        /* Season List */
        <div className="space-y-3">
          {seasons.map((season, idx) => {
            const memberCount =
              season.memberCount ?? season._count?.seasonMembers ?? 0;
            return (
              <motion.div
                key={season.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={`luxury-card p-0 overflow-hidden ${
                  season.isActive ? 'ring-2 ring-gold/30' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        season.isActive
                          ? 'bg-gold/10 border border-gold/30'
                          : 'bg-sage/5 border border-sage/10'
                      }`}
                    >
                      <Calendar
                        className={`h-5 w-5 ${
                          season.isActive ? 'text-gold' : 'text-sage'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink">
                          {season.name}
                        </h3>
                        {season.isActive && (
                          <span className="inline-flex items-center rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold border border-gold/20">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-soft">
                        <span>Year {season.year}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </span>
                        {season.duesAmountCents != null && season.duesAmountCents > 0 && (
                          <span>
                            Dues: ${(season.duesAmountCents / 100).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto sm:ml-0">
                    {!season.isActive && (
                      <button
                        onClick={() => setActivateConfirm(season.id)}
                        disabled={activateLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gold/30 text-gold hover:bg-gold/5 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Activate
                      </button>
                    )}
                  </div>
                </div>

                {/* Season Details Row */}
                {(season.startDate || season.endDate || season.buildStartDate || season.strikeEndDate) && (
                  <div className="border-t border-tan/20 px-5 py-2.5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-soft">
                    {season.startDate && (
                      <span>
                        Start: {formatDateOnly(season.startDate)}
                      </span>
                    )}
                    {season.endDate && (
                      <span>
                        End: {formatDateOnly(season.endDate)}
                      </span>
                    )}
                    {season.buildStartDate && (
                      <span>
                        Build: {formatDateOnly(season.buildStartDate)}
                      </span>
                    )}
                    {season.strikeEndDate && (
                      <span>
                        Strike End: {formatDateOnly(season.strikeEndDate)}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Activate Confirm */}
      <ConfirmDialog
        open={!!activateConfirm}
        onClose={() => setActivateConfirm(null)}
        onConfirm={() => activateConfirm && handleActivate(activateConfirm)}
        title="Activate Season"
        message="This will deactivate the current active season and set this one as active. All admin views will default to this season."
        confirmLabel="Activate"
        variant="warning"
      />

      {/* Create Season Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateSeasonModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              loadSeasons();
              showNotif('Season created successfully.', 'success');
            }}
          />
        )}
      </AnimatePresence>

      {/* Rollover Wizard */}
      <AnimatePresence>
        {showRollover && (
          <RolloverWizard
            seasons={seasons}
            onClose={() => setShowRollover(false)}
            onComplete={() => {
              setShowRollover(false);
              loadSeasons();
              showNotif('Season rollover completed successfully.', 'success');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================================================
// Create Season Modal
// ===========================================================================

function CreateSeasonModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [name, setName] = useState(`Burning Man ${currentYear}`);
  const [duesDollars, setDuesDollars] = useState('');
  const [gridFee30ADollars, setGridFee30ADollars] = useState('');
  const [gridFee50ADollars, setGridFee50ADollars] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buildStartDate, setBuildStartDate] = useState('');
  const [strikeEndDate, setStrikeEndDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const payload: Record<string, unknown> = {
        year,
        name: name.trim(),
      };

      if (duesDollars) payload.duesAmountCents = Math.round(parseFloat(duesDollars) * 100);
      if (gridFee30ADollars) payload.gridFee30ACents = Math.round(parseFloat(gridFee30ADollars) * 100);
      if (gridFee50ADollars) payload.gridFee50ACents = Math.round(parseFloat(gridFee50ADollars) * 100);
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      if (buildStartDate) payload.buildStartDate = buildStartDate;
      if (strikeEndDate) payload.strikeEndDate = strikeEndDate;

      await trpcMutation('seasons.create', payload);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create season.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative luxury-card p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-display-thin text-xl text-ink flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gold" />
            Create Season
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-cream transition-colors"
          >
            <X className="h-5 w-5 text-ink-soft" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
                className="form-input"
                min={2020}
                max={2050}
                required
              />
            </div>
            <div>
              <label className="form-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Burning Man season"
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Dues ($)</label>
              <input
                type="number"
                value={duesDollars}
                onChange={(e) => setDuesDollars(e.target.value)}
                placeholder="0"
                className="form-input"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="form-label">Grid Fee 30A ($)</label>
              <input
                type="number"
                value={gridFee30ADollars}
                onChange={(e) => setGridFee30ADollars(e.target.value)}
                placeholder="0"
                className="form-input"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="form-label">Grid Fee 50A ($)</label>
              <input
                type="number"
                value={gridFee50ADollars}
                onChange={(e) => setGridFee50ADollars(e.target.value)}
                placeholder="0"
                className="form-input"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Build Start</label>
              <input
                type="date"
                value={buildStartDate}
                onChange={(e) => setBuildStartDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Strike End</label>
              <input
                type="date"
                value={strikeEndDate}
                onChange={(e) => setStrikeEndDate(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="cta-primary text-sm px-6 py-2.5 flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Season
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ===========================================================================
// Rollover Wizard
// ===========================================================================

type RolloverStep = 1 | 2 | 3 | 4;
type MemberFilter = 'all_active' | 'confirmed_only' | 'custom';

function RolloverWizard({
  seasons,
  onClose,
  onComplete,
}: {
  seasons: Season[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<RolloverStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Source season
  const [sourceSeasonId, setSourceSeasonId] = useState<string>(
    seasons.find((s) => s.isActive)?.id || seasons[0]?.id || '',
  );

  // Step 2: New season details
  const currentYear = new Date().getFullYear();
  const [newYear, setNewYear] = useState(currentYear + 1);
  const [newName, setNewName] = useState(`Burning Man ${currentYear + 1}`);
  const [newDuesDollars, setNewDuesDollars] = useState('');
  const [newGridFee30ADollars, setNewGridFee30ADollars] = useState('');
  const [newGridFee50ADollars, setNewGridFee50ADollars] = useState('');

  // Step 3: Member filter
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all_active');

  // Result
  const [result, setResult] = useState<RolloverResult | null>(null);

  const sourceSeason = seasons.find((s) => s.id === sourceSeasonId);

  const handleExecute = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload: Record<string, unknown> = {
        sourceSeasonId,
        year: newYear,
        name: newName.trim(),
        memberFilter,
      };

      if (newDuesDollars) payload.duesAmountCents = Math.round(parseFloat(newDuesDollars) * 100);
      if (newGridFee30ADollars) payload.gridFee30ACents = Math.round(parseFloat(newGridFee30ADollars) * 100);
      if (newGridFee50ADollars) payload.gridFee50ACents = Math.round(parseFloat(newGridFee50ADollars) * 100);

      const rolloverResult = await trpcMutation<RolloverResult>('seasons.rollover', payload);
      setResult(rolloverResult);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollover failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Source', 'Details', 'Members', 'Done'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={step !== 4 ? onClose : undefined}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative luxury-card p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-display-thin text-xl text-ink flex items-center gap-2">
            <Zap className="h-5 w-5 text-gold" />
            Season Rollover
          </h2>
          <button
            onClick={step === 4 ? onComplete : onClose}
            className="p-1 rounded-lg hover:bg-cream transition-colors"
          >
            <X className="h-5 w-5 text-ink-soft" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {stepLabels.map((label, idx) => {
            const stepNum = (idx + 1) as RolloverStep;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;

            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      isComplete
                        ? 'bg-green-100 text-green-600 border border-green-200'
                        : isActive
                          ? 'bg-gold/10 text-gold border border-gold/30'
                          : 'bg-cream border border-tan/30 text-ink-soft'
                    }`}
                  >
                    {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNum}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isActive ? 'text-ink' : 'text-ink-soft'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div className="flex-1 h-px bg-tan/30 hidden sm:block" />
                )}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Step 1: Pick Source Season */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Select the source season to roll over members from.
            </p>
            <div className="space-y-2">
              {seasons.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSourceSeasonId(s.id)}
                  className={`w-full flex items-center justify-between rounded-xl border p-3.5 transition-colors ${
                    sourceSeasonId === s.id
                      ? 'border-gold bg-gold/5'
                      : 'border-tan/30 hover:bg-cream'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className={`h-4 w-4 ${sourceSeasonId === s.id ? 'text-gold' : 'text-ink-soft'}`} />
                    <div className="text-left">
                      <p className="text-sm font-medium text-ink">{s.name}</p>
                      <p className="text-xs text-ink-soft">
                        {s.memberCount ?? s._count?.seasonMembers ?? 0} members
                        {s.isActive ? ' \u00B7 Active' : ''}
                      </p>
                    </div>
                  </div>
                  {sourceSeasonId === s.id && (
                    <Check className="h-4 w-4 text-gold shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={!sourceSeasonId}
                className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: New Season Details */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Configure the new season details.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Year</label>
                <input
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(parseInt(e.target.value) || currentYear + 1)}
                  className="form-input"
                  min={2020}
                  max={2050}
                />
              </div>
              <div>
                <label className="form-label">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Burning Man 2027"
                  className="form-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Dues ($)</label>
                <input
                  type="number"
                  value={newDuesDollars}
                  onChange={(e) => setNewDuesDollars(e.target.value)}
                  placeholder="0"
                  className="form-input"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="form-label">Grid 30A ($)</label>
                <input
                  type="number"
                  value={newGridFee30ADollars}
                  onChange={(e) => setNewGridFee30ADollars(e.target.value)}
                  placeholder="0"
                  className="form-input"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="form-label">Grid 50A ($)</label>
                <input
                  type="number"
                  value={newGridFee50ADollars}
                  onChange={(e) => setNewGridFee50ADollars(e.target.value)}
                  placeholder="0"
                  className="form-input"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!newName.trim()}
                className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Member Filter + Review */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-ink-soft mb-3">
                Choose which members to enroll in the new season.
              </p>
              <div className="space-y-2">
                {[
                  { value: 'all_active' as const, label: 'All Active Members', desc: 'Roll over everyone from the source season' },
                  { value: 'confirmed_only' as const, label: 'Confirmed Only', desc: 'Only members with CONFIRMED status' },
                  { value: 'custom' as const, label: 'No Members', desc: 'Create season without enrolling anyone' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMemberFilter(opt.value)}
                    className={`w-full flex items-center justify-between rounded-xl border p-3.5 transition-colors ${
                      memberFilter === opt.value
                        ? 'border-gold bg-gold/5'
                        : 'border-tan/30 hover:bg-cream'
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-ink">{opt.label}</p>
                      <p className="text-xs text-ink-soft">{opt.desc}</p>
                    </div>
                    {memberFilter === opt.value && (
                      <Check className="h-4 w-4 text-gold shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Review Summary */}
            <div className="rounded-xl border border-tan/30 bg-cream/50 p-4 space-y-2">
              <h4 className="text-xs font-medium text-ink-soft uppercase tracking-wider">
                Summary
              </h4>
              <div className="space-y-1 text-sm text-ink">
                <p>
                  <span className="text-ink-soft">Source:</span>{' '}
                  <span className="font-medium">{sourceSeason?.name || 'Unknown'}</span>
                </p>
                <p className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-gold" />
                  <span className="text-ink-soft">New Season:</span>{' '}
                  <span className="font-medium">
                    {newName} ({newYear})
                  </span>
                </p>
                <p>
                  <span className="text-ink-soft">Members:</span>{' '}
                  <span className="font-medium">
                    {memberFilter === 'all_active'
                      ? 'All active'
                      : memberFilter === 'confirmed_only'
                        ? 'Confirmed only'
                        : 'None'}
                  </span>
                </p>
                {newDuesDollars && (
                  <p>
                    <span className="text-ink-soft">Dues:</span>{' '}
                    <span className="font-medium">${parseFloat(newDuesDollars).toFixed(2)}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleExecute}
                disabled={loading}
                className="cta-primary text-sm px-6 py-2.5 flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {loading ? 'Rolling over...' : 'Start Rollover'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && result && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 border border-green-200 mb-4">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="text-display-thin text-xl text-ink mb-2">
                Rollover Complete
              </h3>
              <p className="text-body-relaxed text-sm text-ink-soft">
                Season &ldquo;{result.season.name}&rdquo; has been created with{' '}
                <span className="font-semibold text-ink">{result.membersEnrolled}</span>{' '}
                member{result.membersEnrolled !== 1 ? 's' : ''} enrolled.
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={onComplete}
                className="cta-primary text-sm px-6 py-2.5"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
