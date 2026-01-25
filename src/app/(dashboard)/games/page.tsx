'use client';

import { useState } from 'react';
import { useGames } from '@/hooks/useGames';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { GameCard } from '@/components/games/GameCard';
import { DataState } from '@/components/ui/DataState';
import { Calendar, ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react';

const conferenceOptions = [
  { value: 'all', label: 'All Conferences' },
  { value: 'east', label: 'Eastern' },
  { value: 'west', label: 'Western' },
];

const statusOptions = [
  { value: 'all', label: 'All Games' },
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'final', label: 'Completed' },
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
    gameTime:
      game.status === 'Final'
        ? 'Final'
        : game.time
          ? game.time
          : new Date(game.date).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
            }),
    status: game.status,
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

export default function GamesPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [conference, setConference] = useState('all');
  const [status, setStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const dateString = selectedDate.toISOString().split('T')[0];
  const { games, isLoading, isError, refresh } = useGames(dateString);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  // Transform and filter games
  const transformedGames = (games || []).map(transformGameData);

  const filteredGames = transformedGames.filter((game) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesHome =
        game.homeTeam.name.toLowerCase().includes(query) ||
        game.homeTeam.abbreviation.toLowerCase().includes(query);
      const matchesAway =
        game.awayTeam.name.toLowerCase().includes(query) ||
        game.awayTeam.abbreviation.toLowerCase().includes(query);
      if (!matchesHome && !matchesAway) return false;
    }

    // Status filter
    if (status !== 'all') {
      if (status === 'final' && game.status !== 'Final') return false;
      if (status === 'scheduled' && game.status === 'Final') return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">NBA Games</h1>
          <p className="text-slate-400 mt-1">Browse games and predictions by date</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Date Navigation */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-4">
              <Button
                variant={isToday ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Today
              </Button>

              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-400" />
                <span className="text-lg font-semibold text-white">
                  {formatDate(selectedDate)}
                </span>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>

        <Select
          options={conferenceOptions}
          value={conference}
          onChange={(e) => setConference(e.target.value)}
          className="w-40 bg-slate-800 border-slate-700"
        />

        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-40 bg-slate-800 border-slate-700"
        />
      </div>

      {/* Games List */}
      <DataState
        isLoading={isLoading}
        isError={!!isError}
        isEmpty={filteredGames.length === 0}
        onRetry={refresh}
        loadingMessage="Loading games..."
        errorMessage="Failed to load games"
        emptyMessage="No Games Found"
        emptyDescription="No games scheduled for this date or matching your filters."
      >
        <div className="space-y-4">
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </DataState>
    </div>
  );
}
