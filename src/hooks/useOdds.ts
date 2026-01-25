'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UseOddsOptions {
  date?: string;
}

export function useOdds(options: UseOddsOptions = {}) {
  const params = new URLSearchParams();
  if (options.date) {
    params.set('date', options.date);
  }

  const queryString = params.toString();
  const url = `/api/odds${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 minutes - conserve API quota
  });

  return {
    odds: data?.data || [],
    meta: data?.meta,
    remainingRequests: data?.remainingRequests,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useGameOdds(gameId: string | number | null) {
  const { data, error, isLoading, mutate } = useSWR(
    gameId ? `/api/odds/${gameId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
    }
  );

  return {
    odds: data?.data || null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
