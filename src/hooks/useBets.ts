'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UseBetsOptions {
  result?: string;
  oddsType?: string;
  limit?: number;
}

export function useBets(options: UseBetsOptions = {}) {
  const params = new URLSearchParams();
  if (options.result) params.set('result', options.result);
  if (options.oddsType) params.set('oddsType', options.oddsType);
  if (options.limit) params.set('limit', options.limit.toString());

  const queryString = params.toString();
  const url = `/api/bets${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    bets: data?.data || [],
    meta: data?.meta,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useAnalytics() {
  const { data, error, isLoading, mutate } = useSWR('/api/analytics', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 minutes
  });

  return {
    analytics: data?.data || null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
