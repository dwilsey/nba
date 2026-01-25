'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useGames(date?: string) {
  const params = date ? `?date=${date}` : '';
  const { data, error, isLoading, mutate } = useSWR(
    `/api/games${params}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    games: data?.data || [],
    meta: data?.meta,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useTodaysGames() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/games/today',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    games: data?.data || [],
    meta: data?.meta,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
