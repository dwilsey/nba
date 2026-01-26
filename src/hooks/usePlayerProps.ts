'use client';

import useSWR from 'swr';
import { PropType } from '@/lib/predictions/props';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface PlayerPropResponse {
  player: {
    id: number;
    name: string;
    position: string;
    team: {
      id: number;
      abbreviation: string;
      full_name: string;
    };
  };
  propType: PropType;
  line: number;
  stats: {
    seasonAverage: number;
    recentAverage: number;
    recentGames: number;
    gamesPlayed: number;
    trend: 'up' | 'down' | 'stable';
  };
  prediction: {
    predictedValue: number;
    overProbability: number;
    underProbability: number;
    confidence: number;
    recommendation: 'over' | 'under' | 'pass';
    edge: number;
  };
  factors: {
    seasonAverage: {
      value: number;
      weight: number;
      contribution: number;
    };
    recentForm: {
      value: number;
      trend: 'up' | 'down' | 'stable';
      weight: number;
      contribution: number;
    };
    matchup: {
      opponentRating: number;
      adjustment: number;
      weight: number;
      contribution: number;
    };
    context: {
      homeAway: number;
      minutes: number;
      backToBack: number;
      weight: number;
      contribution: number;
    };
  };
  meta: {
    generatedAt: string;
    season: number;
  };
}

export interface UsePlayerPropsOptions {
  playerId: number;
  propType?: PropType;
  line?: number;
  opponentId?: number;
  isHome?: boolean;
}

export function usePlayerProps(options: UsePlayerPropsOptions | null) {
  const buildUrl = () => {
    if (!options?.playerId) return null;

    const params = new URLSearchParams();
    if (options.propType) params.set('type', options.propType);
    if (options.line) params.set('line', options.line.toString());
    if (options.opponentId) params.set('opponent', options.opponentId.toString());
    if (options.isHome !== undefined) params.set('home', options.isHome.toString());

    const queryString = params.toString();
    return `/api/players/${options.playerId}/props${queryString ? `?${queryString}` : ''}`;
  };

  const url = buildUrl();

  const { data, error, isLoading, mutate } = useSWR<PlayerPropResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    data,
    player: data?.player,
    stats: data?.stats,
    prediction: data?.prediction,
    factors: data?.factors,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useMultiplePlayerProps(playerIds: number[], propType?: PropType) {
  // Use SWR's multiple key pattern
  const urls = playerIds.map(
    (id) => `/api/players/${id}/props${propType ? `?type=${propType}` : ''}`
  );

  const { data, error, isLoading } = useSWR(
    playerIds.length > 0 ? urls : null,
    async (urls: string[]) => {
      const results = await Promise.all(
        urls.map((url) => fetcher(url))
      );
      return results;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    data: data as PlayerPropResponse[] | undefined,
    isLoading,
    isError: error,
  };
}

export default usePlayerProps;
