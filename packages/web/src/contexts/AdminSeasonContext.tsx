'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';


interface Season {
  id: string;
  year: number;
  name: string;
  isActive: boolean;
}

interface AdminSeasonContextType {
  seasons: Season[];
  selectedSeasonId: string | null;
  selectedSeason: Season | null;
  setSelectedSeasonId: (id: string) => void;
  isLoading: boolean;
}

const AdminSeasonContext = createContext<AdminSeasonContextType | undefined>(undefined);

export function AdminSeasonProvider({ children }: { children: ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch seasons once on mount. We use a functional setter for
  // selectedSeasonId so that fetchSeasons does not need selectedSeasonId
  // in its dependency array — avoiding a redundant refetch every time
  // the user switches seasons in the dropdown.
  useEffect(() => {
    let cancelled = false;
    const fetchSeasons = async () => {
      try {
        const res = await fetch(`/api/trpc/seasons.list`);
        if (!res.ok) return;
        const json = await res.json();
        // Server uses superjson transformer:
        // { result: { data: { json: Season[], meta: ... } } }
        const list: Season[] = json.result?.data?.json ?? [];
        if (cancelled) return;
        setSeasons(list);

        // Default to active season, or first in list — only if nothing selected yet
        setSelectedSeasonId((current) => {
          if (current || list.length === 0) return current;
          const active = list.find((s) => s.isActive);
          return active?.id || list[0].id;
        });
      } catch {
        // API unavailable
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSeasons();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) || null;

  return (
    <AdminSeasonContext.Provider
      value={{ seasons, selectedSeasonId, selectedSeason, setSelectedSeasonId, isLoading }}
    >
      {children}
    </AdminSeasonContext.Provider>
  );
}

export function useAdminSeason() {
  const context = useContext(AdminSeasonContext);
  if (context === undefined) {
    throw new Error('useAdminSeason must be used within an AdminSeasonProvider');
  }
  return context;
}
