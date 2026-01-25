'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UsePredictionsOptions {
  date?: string;
  limit?: number;
}

export function usePredictions(options: UsePredictionsOptions = {}) {
  const params = new URLSearchParams();
  if (options.date) params.set('date', options.date);
  if (options.limit) params.set('limit', options.limit.toString());

  const queryString = params.toString();
  const url = `/api/predictions${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 minute
  });

  return {
    predictions: data?.data || [],
    meta: data?.meta,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function usePredictionAccuracy(season?: number) {
  const params = new URLSearchParams();
  if (season) params.set('season', season.toString());

  const queryString = params.toString();
  const url = `/api/predictions/accuracy${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 minutes
  });

  return {
    accuracy: data?.data || null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useTodaysPredictions() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/predictions/today',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    predictions: data?.data || [],
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
