'use client';

import { useState } from 'react';
import { useTodaysGames } from '@/hooks/useGames';
import { GameCard } from './GameCard';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DataState } from '@/components/ui/DataState';
import { Filter, RefreshCw } from 'lucide-react';

const conferenceOptions = [
  { value: 'all', label: 'All Teams' },
  { value: 'east', label: 'Eastern Conference' },
  { value: 'west', label: 'Western Conference' },
];

// Transform API game data to GameCard format
function transformGameData(game: any) {
  return {
    id: game.id?.toString() || game.externalId?.toString() || '0',
    homeTeam: {
      name: game.home_team?.full_name || game.homeTeam?.name || 'Home Team',
      abbreviation: game.home_team?.abbreviation || game.homeTeam?.abbreviation || 'HOM',
      record: game.homeTeam?.record || '--',
    },
    awayTeam: {
      name: game.visitor_team?.full_name || game.awayTeam?.name || 'Away Team',
      abbreviation: game.visitor_team?.abbreviation || game.awayTeam?.abbreviation || 'AWY',
      record: game.awayTeam?.record || '--',
    },
    gameTime: game.status === 'Final'
      ? 'Final'
      : game.time
        ? game.time
        : new Date(game.date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
          }),
    prediction: game.prediction
      ? {
          homeWinProb: game.prediction.homeWinProbability || 0.5,
          awayWinProb: game.prediction.awayWinProbability || 0.5,
          spread: game.prediction.spreadPrediction || 0,
          confidence: game.prediction.confidence || 0.5,
          hasValue: game.prediction.hasValue || false,
          valueBet: game.prediction.valueBet || null,
        }
      : {
          homeWinProb: 0.5,
          awayWinProb: 0.5,
          spread: 0,
          confidence: 0.5,
          hasValue: false,
          valueBet: null,
        },
    odds: game.odds
      ? {
          homeML: game.odds.homeMoneyline || 0,
          awayML: game.odds.awayMoneyline || 0,
          spread: game.odds.spread || 0,
          total: game.odds.total || 0,
        }
      : {
          homeML: 0,
          awayML: 0,
          spread: 0,
          total: 0,
        },
  };
}

export function TodaysGames() {
  const { games, isLoading, isError, refresh } = useTodaysGames();
  const [filter, setFilter] = useState('all');
  const [showValueOnly, setShowValueOnly] = useState(false);

  // Transform and filter games
  const transformedGames = (games || []).map(transformGameData);

  const filteredGames = transformedGames.filter((game) => {
    if (showValueOnly && !game.prediction.hasValue) return false;
    // Conference filtering would require team conference data
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select
            options={conferenceOptions}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-48 bg-slate-700 border-slate-600"
          />
        </div>

        <Button
          variant={showValueOnly ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowValueOnly(!showValueOnly)}
        >
          Value Bets Only
        </Button>

        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Games Content */}
      <DataState
        isLoading={isLoading}
        isError={!!isError}
        isEmpty={filteredGames.length === 0}
        onRetry={refresh}
        loadingMessage="Loading today's games..."
        errorMessage="Failed to load games"
        emptyMessage="No games scheduled for today"
        emptyDescription="Check back later or browse upcoming games"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </DataState>
    </div>
  );
}
