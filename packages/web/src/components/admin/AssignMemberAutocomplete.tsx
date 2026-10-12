'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, UserPlus, X } from 'lucide-react';
import { fetchSeasonMembers } from '../../lib/adminApi';

interface MemberOption {
  id: string; // seasonMemberId
  memberId: string;
  name: string;
  email: string;
  playaName?: string;
}

interface Props {
  seasonId: string | null | undefined;
  /** seasonMemberIds already assigned — excluded from results */
  excludeSeasonMemberIds?: string[];
  /** Called with the selected seasonMemberId */
  onSelect: (sm: MemberOption) => void | Promise<void>;
  placeholder?: string;
  /** Optional disabled state while a mutation is running */
  disabled?: boolean;
}

export default function AssignMemberAutocomplete({
  seasonId,
  excludeSeasonMemberIds,
  onSelect,
  placeholder = 'Search members...',
  disabled,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const excludeSet = useRef<Set<string>>(new Set());
  useEffect(() => {
    excludeSet.current = new Set(excludeSeasonMemberIds || []);
  }, [excludeSeasonMemberIds]);

  const search = useCallback(async (term: string) => {
    if (!seasonId) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchSeasonMembers({
        seasonId,
        search: term || undefined,
        limit: 25,
        offset: 0,
      });
      const opts: MemberOption[] = (result.seasonMembers || [])
        .map((sm) => ({
          id: sm.id,
          memberId: sm.member.id,
          name: sm.member.name,
          email: sm.member.email,
          playaName: sm.member.playaName ?? undefined,
        }))
        .filter((opt) => !excludeSet.current.has(opt.id));
      setResults(opts);
      setActiveIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  // Debounce the search
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => search(query), 200);
    return () => clearTimeout(handle);
  }, [query, open, search]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [open]);

  const handleSelect = async (opt: MemberOption) => {
    setBusyId(opt.id);
    try {
      await onSelect(opt);
      setQuery('');
      setOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft/50 pointer-events-none" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && results[activeIdx]) {
              e.preventDefault();
              handleSelect(results[activeIdx]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="form-input pl-10 pr-8"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-soft/40 hover:text-ink-soft transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-tan/30 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 text-gold animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-ink-soft text-center">
              {query ? `No members match "${query}".` : 'Start typing to search...'}
            </div>
          ) : (
            results.map((opt, idx) => (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt)}
                disabled={busyId === opt.id}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-cream transition-colors disabled:opacity-50 ${
                  idx === activeIdx ? 'bg-sage/5' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{opt.name}</p>
                  <p className="text-xs text-ink-soft truncate">
                    {opt.email}{opt.playaName ? ` · "${opt.playaName}"` : ''}
                  </p>
                </div>
                {busyId === opt.id ? (
                  <Loader2 className="h-3.5 w-3.5 text-gold animate-spin shrink-0" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5 text-sage shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
