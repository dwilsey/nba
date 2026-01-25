'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UseTeamsOptions {
  conference?: 'east' | 'west' | 'all';
}

export function useTeams(options: UseTeamsOptions = {}) {
  const params = new URLSearchParams();
  if (options.conference && options.conference !== 'all') {
    params.set('conference', options.conference);
  }

  const queryString = params.toString();
  const url = `/api/stats/teams${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 minutes
  });

  return {
    teams: data?.data || [],
    meta: data?.meta,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useTeam(teamId: number | string) {
  const { data, error, isLoading, mutate } = useSWR(
    teamId ? `/api/stats/teams/${teamId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
    }
  );

  return {
    team: data?.data || null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
