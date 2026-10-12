'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  GitMerge,
  Loader2,
  AlertCircle,
  Check,
  X,
  Users,
  Mail,
  Phone,
  Tag,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

type Candidate = {
  id: string;
  name: string;
  email: string;
  playaName: string | null;
  phone: string | null;
  role: 'LEAD' | 'MANAGER' | 'MEMBER';
  previousEmails: string[];
  seasonYears: number[];
  seasonCount: number;
};

type MergePlan = {
  source: Candidate;
  target: Candidate;
  group: Candidate[];
};

function CandidateCard({
  candidate,
  others,
  onKeep,
  isPending,
}: {
  candidate: Candidate;
  others: Candidate[];
  onKeep: (target: Candidate, others: Candidate[]) => void;
  isPending: boolean;
}) {
  return (
    <div className="luxury-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-ink truncate">{candidate.name}</p>
          {candidate.playaName && (
            <p className="text-xs text-ink-soft italic truncate">
              &ldquo;{candidate.playaName}&rdquo;
            </p>
          )}
        </div>
        <span className="inline-flex items-center rounded-md bg-sage/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sage shrink-0">
          {candidate.role}
        </span>
      </div>

      <div className="space-y-1.5 text-sm flex-1">
        <div className="flex items-start gap-2 text-ink-soft">
          <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="break-all">{candidate.email}</span>
        </div>
        {candidate.phone && (
          <div className="flex items-center gap-2 text-ink-soft">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{candidate.phone}</span>
          </div>
        )}
        {candidate.previousEmails.length > 0 && (
          <div className="flex items-start gap-2 text-ink-soft">
            <Tag className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-ink-soft/70">
                Previous emails ({candidate.previousEmails.length})
              </span>
              <div className="text-xs break-all">
                {candidate.previousEmails.join(', ')}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2 text-ink-soft">
          <Calendar className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-ink-soft/70">
              {candidate.seasonCount} season{candidate.seasonCount === 1 ? '' : 's'}
            </span>
            {candidate.seasonYears.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {candidate.seasonYears.map((y) => (
                  <span
                    key={y}
                    className="inline-flex items-center rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold tabular-nums"
                  >
                    {y}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="pt-2 text-[10px] text-ink-soft/60 font-mono truncate">
          {candidate.id}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-tan/20 flex items-center justify-between gap-2">
        <Link
          href={`/admin/members/${candidate.id}`}
          className="text-xs text-sage hover:text-gold transition-colors"
          target="_blank"
        >
          Open profile →
        </Link>
        <button
          onClick={() => onKeep(candidate, others)}
          disabled={isPending}
          className="cta-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <GitMerge className="h-3.5 w-3.5" />
          Merge other → this
        </button>
      </div>
    </div>
  );
}

function DuplicateGroup({
  groupLabel,
  group,
  onKeep,
  isPending,
}: {
  groupLabel: string;
  group: Candidate[];
  onKeep: (target: Candidate, others: Candidate[]) => void;
  isPending: boolean;
}) {
  return (
    <div className="frame-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-gold" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
          {groupLabel} · {group.length} candidates
        </p>
      </div>
      <div className={`grid gap-4 ${group.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {group.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            others={group.filter((g) => g.id !== c.id)}
            onKeep={onKeep}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
}

export default function MembersMergePage() {
  const utils = trpc.useContext();
  const { data, isLoading, error, refetch, isFetching } =
    trpc.members.findDuplicateCandidates.useQuery();

  const mergeMutation = trpc.members.mergeMembers.useMutation({
    onSuccess: async () => {
      await utils.members.findDuplicateCandidates.invalidate();
    },
  });

  const [plan, setPlan] = useState<MergePlan | null>(null);
  const [finalName, setFinalName] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [lastMergeResult, setLastMergeResult] = useState<{
    movedSeasons: number;
    deletedSeasons: number;
    previousEmailsCount: number;
    finalName: string;
  } | null>(null);

  const handleKeep = (target: Candidate, others: Candidate[]) => {
    setMergeError(null);
    setLastMergeResult(null);
    // For a 2-card group, source is auto-determined.
    // For >2, default to the first "other" — user can change in the modal.
    const source = others[0];
    setPlan({ source, target, group: [target, ...others] });
    setFinalName(target.name);
  };

  const closeModal = () => {
    setPlan(null);
    setMergeError(null);
    setFinalName('');
  };

  const handleConfirmMerge = async () => {
    if (!plan) return;
    setMergeError(null);
    try {
      const result = await mergeMutation.mutateAsync({
        sourceId: plan.source.id,
        targetId: plan.target.id,
        finalName: finalName.trim() && finalName.trim() !== plan.target.name
          ? finalName.trim()
          : undefined,
      });
      setLastMergeResult({
        movedSeasons: result.movedSeasons,
        deletedSeasons: result.deletedSeasons,
        previousEmailsCount: result.previousEmailsCount,
        finalName: result.finalName,
      });
      closeModal();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Merge failed');
    }
  };

  const mergePreview = useMemo(() => {
    if (!plan) return null;
    const targetSeasonSet = new Set(plan.target.seasonYears);
    const willMove = plan.source.seasonYears.filter((y) => !targetSeasonSet.has(y));
    const willDelete = plan.source.seasonYears.filter((y) => targetSeasonSet.has(y));
    const emailsToAppend = [...new Set([
      ...plan.source.previousEmails,
      plan.source.email,
    ])].filter((e) => e && e !== plan.target.email);
    return { willMove, willDelete, emailsToAppend };
  }, [plan]);

  const totalGroups =
    (data?.exactNameDups.length ?? 0) +
    (data?.softDups.length ?? 0) +
    (data?.emailInPreviousEmails.length ?? 0);

  return (
    <div className="section-base space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin/members"
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-gold transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Members
          </Link>
          <h1 className="text-display-thin text-3xl text-ink">Merge duplicate members</h1>
          <p className="text-body-relaxed text-sm text-ink-soft mt-1 max-w-2xl">
            Review duplicate-candidate groups. For each group, click &ldquo;Merge other → this&rdquo;
            on the row you want to keep. The other row will be deleted and its history rolled up
            onto the survivor.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Last merge banner */}
      <AnimatePresence>
        {lastMergeResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3"
          >
            <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="text-sm text-green-800 flex-1">
              <p className="font-medium">
                Merged into &ldquo;{lastMergeResult.finalName}&rdquo;.
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                {lastMergeResult.movedSeasons} season(s) moved,{' '}
                {lastMergeResult.deletedSeasons} duplicate season(s) deleted,{' '}
                {lastMergeResult.previousEmailsCount} email(s) preserved on survivor.
              </p>
            </div>
            <button
              onClick={() => setLastMergeResult(null)}
              className="p-1 text-green-700 hover:text-green-900 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Scanning members for duplicates...</p>
        </div>
      ) : data && totalGroups === 0 ? (
        <div className="luxury-card p-12 text-center">
          <div className="admin-icon-box mx-auto mb-4 h-14 w-14">
            <Check className="h-7 w-7 text-gold" />
          </div>
          <h3 className="text-display-thin text-xl text-ink mb-2">No duplicates found</h3>
          <p className="text-sm text-ink-soft">
            All member rows look unique by name and previousEmails cross-check.
          </p>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Exact name duplicates */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-xl text-ink">
                Exact name duplicates
              </h2>
              <span className="text-xs text-ink-soft">
                {data.exactNameDups.length} group(s)
              </span>
            </div>
            {data.exactNameDups.length === 0 ? (
              <p className="text-sm text-ink-soft italic">None.</p>
            ) : (
              <div className="space-y-4">
                {data.exactNameDups.map((group, i) => (
                  <DuplicateGroup
                    key={`exact-${i}`}
                    groupLabel={`"${group[0].name}"`}
                    group={group}
                    onKeep={handleKeep}
                    isPending={mergeMutation.isLoading}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Soft duplicates */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-xl text-ink">
                Soft duplicates (same first + last name)
              </h2>
              <span className="text-xs text-ink-soft">
                {data.softDups.length} group(s)
              </span>
            </div>
            {data.softDups.length === 0 ? (
              <p className="text-sm text-ink-soft italic">None.</p>
            ) : (
              <div className="space-y-4">
                {data.softDups.map((group, i) => {
                  const first = group[0].name.split(/\s+/)[0];
                  const last = group[0].name.split(/\s+/).slice(-1)[0];
                  return (
                    <DuplicateGroup
                      key={`soft-${i}`}
                      groupLabel={`"${first} ... ${last}"`}
                      group={group}
                      onKeep={handleKeep}
                      isPending={mergeMutation.isLoading}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Cross-history: email in previousEmails */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-xl text-ink">
                Cross-history (email appears in another member&rsquo;s previousEmails)
              </h2>
              <span className="text-xs text-ink-soft">
                {data.emailInPreviousEmails.length} match(es)
              </span>
            </div>
            {data.emailInPreviousEmails.length === 0 ? (
              <p className="text-sm text-ink-soft italic">None.</p>
            ) : (
              <div className="space-y-4">
                {data.emailInPreviousEmails.map((pair, i) => (
                  <div key={`cross-${i}`} className="frame-panel p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-gold" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                        &ldquo;{pair.matchedEmail}&rdquo; is current on one row, historical on another
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CandidateCard
                        candidate={pair.other}
                        others={[pair.holder]}
                        onKeep={handleKeep}
                        isPending={mergeMutation.isLoading}
                      />
                      <CandidateCard
                        candidate={pair.holder}
                        others={[pair.other]}
                        onKeep={handleKeep}
                        isPending={mergeMutation.isLoading}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* Merge confirmation modal */}
      <AnimatePresence>
        {plan && mergePreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={mergeMutation.isLoading ? undefined : closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative luxury-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold mb-1">
                    Confirm merge
                  </p>
                  <h2 className="text-display-thin text-xl text-ink">
                    Merge into &ldquo;{plan.target.name}&rdquo;
                  </h2>
                </div>
                <button
                  onClick={closeModal}
                  disabled={mergeMutation.isLoading}
                  className="p-1 rounded-lg hover:bg-cream transition-colors disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-ink-soft" />
                </button>
              </div>

              {/* Source picker (only relevant if group >2) */}
              {plan.group.length > 2 && (
                <div className="mb-5">
                  <label className="form-label">Source (will be deleted)</label>
                  <select
                    value={plan.source.id}
                    onChange={(e) => {
                      const newSource = plan.group.find((c) => c.id === e.target.value);
                      if (newSource) {
                        setPlan({ ...plan, source: newSource });
                      }
                    }}
                    disabled={mergeMutation.isLoading}
                    className="form-input w-full"
                  >
                    {plan.group
                      .filter((c) => c.id !== plan.target.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.email} ({c.seasonCount} season{c.seasonCount === 1 ? '' : 's'})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Pair summary */}
              <div className="grid gap-3 sm:grid-cols-2 mb-5">
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700 mb-1">
                    Source (deleted)
                  </p>
                  <p className="font-medium text-ink text-sm truncate">{plan.source.name}</p>
                  <p className="text-xs text-ink-soft break-all">{plan.source.email}</p>
                  <p className="text-xs text-ink-soft mt-1">
                    {plan.source.seasonCount} season(s):{' '}
                    {plan.source.seasonYears.join(', ') || 'none'}
                  </p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 mb-1">
                    Target (kept)
                  </p>
                  <p className="font-medium text-ink text-sm truncate">{plan.target.name}</p>
                  <p className="text-xs text-ink-soft break-all">{plan.target.email}</p>
                  <p className="text-xs text-ink-soft mt-1">
                    {plan.target.seasonCount} season(s):{' '}
                    {plan.target.seasonYears.join(', ') || 'none'}
                  </p>
                </div>
              </div>

              {/* What will happen */}
              <div className="luxury-card p-4 mb-5 bg-cream/30">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold mb-2">
                  What will happen
                </p>
                <ul className="text-sm text-ink-soft space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-gold shrink-0">•</span>
                    <span>
                      <strong className="text-ink tabular-nums">
                        {mergePreview.willMove.length}
                      </strong>{' '}
                      season(s) will move to the survivor
                      {mergePreview.willMove.length > 0 && (
                        <span className="text-xs ml-1">
                          ({mergePreview.willMove.join(', ')})
                        </span>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold shrink-0">•</span>
                    <span>
                      <strong className="text-ink tabular-nums">
                        {mergePreview.willDelete.length}
                      </strong>{' '}
                      season(s) will be deleted as duplicates (survivor already has them)
                      {mergePreview.willDelete.length > 0 && (
                        <span className="text-xs ml-1">
                          ({mergePreview.willDelete.join(', ')})
                        </span>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold shrink-0">•</span>
                    <span>
                      <strong className="text-ink tabular-nums">
                        {mergePreview.emailsToAppend.length}
                      </strong>{' '}
                      email(s) will be preserved on the survivor&rsquo;s previousEmails
                      {mergePreview.emailsToAppend.length > 0 && (
                        <span className="text-xs block break-all mt-0.5">
                          ({mergePreview.emailsToAppend.join(', ')})
                        </span>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold shrink-0">•</span>
                    <span>
                      Tickets, announcements, audit logs, and application sponsor/reviewer
                      references will be reassigned to the survivor.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 shrink-0">•</span>
                    <span className="text-ink">
                      The source row (
                      <span className="font-mono text-xs">{plan.source.id.slice(0, 8)}…</span>
                      ) will be permanently deleted.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Optional final name */}
              <div className="mb-5">
                <label className="form-label">Final name (on survivor)</label>
                <input
                  type="text"
                  value={finalName}
                  onChange={(e) => setFinalName(e.target.value)}
                  disabled={mergeMutation.isLoading}
                  className="form-input w-full"
                  placeholder={plan.target.name}
                />
                {finalName.trim() && finalName.trim() !== plan.target.name && (
                  <p className="text-xs text-gold mt-1">
                    Survivor will be renamed: &ldquo;{plan.target.name}&rdquo; → &ldquo;
                    {finalName.trim()}&rdquo;
                  </p>
                )}
              </div>

              {mergeError && (
                <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-5">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{mergeError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  disabled={mergeMutation.isLoading}
                  className="cta-secondary text-sm px-4 py-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={mergeMutation.isLoading}
                  className="cta-primary text-sm px-5 py-2 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {mergeMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GitMerge className="h-4 w-4" />
                  )}
                  Confirm merge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
