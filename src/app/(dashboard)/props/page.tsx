'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { PlayerPropCard } from '@/components/props/PlayerPropCard';
import { PropType, getPropTypeName } from '@/lib/predictions/props';
import { cn } from '@/lib/utils/cn';
import { Search, TrendingUp, X } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PlayerSearchResult {
  id: number;
  name: string;
  position: string;
  team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
}

const PROP_TYPES: PropType[] = [
  'points',
  'rebounds',
  'assists',
  'threes',
  'pra',
  'pr',
  'pa',
];

export default function PropsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [selectedPropType, setSelectedPropType] = useState<PropType>('points');
  const [propLine, setPropLine] = useState<string>('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search players
  const { data: searchResults, isLoading: isSearching } = useSWR(
    debouncedQuery.length >= 2 ? `/api/players/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    fetcher
  );

  const handleSelectPlayer = useCallback((player: PlayerSearchResult) => {
    setSelectedPlayer(player);
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  const handleClearPlayer = useCallback(() => {
    setSelectedPlayer(null);
    setPropLine('');
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Player Props</h1>
        <p className="text-slate-400 mt-1">
          Analyze player prop predictions based on historical performance and matchup data
        </p>
      </div>

      {/* Search Section */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-400" />
            Search Player
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a player (e.g., LeBron James)"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size="sm" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults?.data?.length > 0 && !selectedPlayer && (
            <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden">
              {searchResults.data.map((player: PlayerSearchResult) => (
                <button
                  key={player.id}
                  onClick={() => handleSelectPlayer(player)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-600 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-white">{player.name}</div>
                    <div className="text-sm text-slate-400">
                      {player.position} - {player.team.full_name}
                    </div>
                  </div>
                  <Badge variant="default">{player.team.abbreviation}</Badge>
                </button>
              ))}
            </div>
          )}

          {/* Selected Player */}
          {selectedPlayer && (
            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {selectedPlayer.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold text-white text-lg">{selectedPlayer.name}</div>
                  <div className="text-slate-400">
                    {selectedPlayer.position} - {selectedPlayer.team.full_name}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearPlayer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prop Configuration */}
      {selectedPlayer && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Prop Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prop Type Selection */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Prop Type</label>
              <div className="flex flex-wrap gap-2">
                {PROP_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedPropType(type)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      selectedPropType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    )}
                  >
                    {getPropTypeName(type)}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Input */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Betting Line (optional)
              </label>
              <input
                type="number"
                value={propLine}
                onChange={(e) => setPropLine(e.target.value)}
                placeholder="e.g., 25.5"
                step="0.5"
                className="w-full max-w-xs bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter the sportsbook line for more accurate predictions
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prediction Result */}
      {selectedPlayer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlayerPropCard
            playerId={selectedPlayer.id}
            propType={selectedPropType}
            line={propLine ? parseFloat(propLine) : undefined}
            className="bg-slate-800 border-slate-700"
          />

          {/* Quick Props for Other Types */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Other Props</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {PROP_TYPES.filter(t => t !== selectedPropType).slice(0, 4).map((type) => (
                <QuickPropRow
                  key={type}
                  playerId={selectedPlayer.id}
                  propType={type}
                  onClick={() => setSelectedPropType(type)}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!selectedPlayer && (
        <Card className="bg-slate-800/50 border-slate-700 border-dashed">
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              Search for a player
            </h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Enter a player name above to view prop predictions based on their season
              statistics, recent form, and matchup data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Quick prop row component
function QuickPropRow({
  playerId,
  propType,
  onClick,
}: {
  playerId: number;
  propType: PropType;
  onClick: () => void;
}) {
  const { data, isLoading } = useSWR(
    `/api/players/${playerId}/props?type=${propType}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
        <span className="text-slate-400">{getPropTypeName(propType)}</span>
        <Spinner size="sm" />
      </div>
    );
  }

  if (!data?.prediction || !data?.line) {
    return (
      <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg opacity-50">
        <span className="text-slate-400">{getPropTypeName(propType)}</span>
        <span className="text-slate-500 text-sm">No data</span>
      </div>
    );
  }

  const { prediction, line } = data;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors text-left"
    >
      <div>
        <div className="text-white font-medium">{getPropTypeName(propType)}</div>
        <div className="text-sm text-slate-400">
          Line: {line?.toFixed(1) || 'N/A'}
        </div>
      </div>
      <div className="text-right">
        <div className="text-white font-medium">
          {prediction.predictedValue.toFixed(1)}
        </div>
        <Badge
          variant={
            prediction.recommendation === 'over'
              ? 'success'
              : prediction.recommendation === 'under'
              ? 'danger'
              : 'default'
          }
          className="text-xs"
        >
          {prediction.recommendation.toUpperCase()}
        </Badge>
      </div>
    </button>
  );
}
