'use client';

import { useOdds } from '@/hooks/useOdds';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataState } from '@/components/ui/DataState';
import { DollarSign, Clock, AlertCircle, RefreshCw } from 'lucide-react';

// Transform API odds data to display format
function transformOddsData(gameOdds: any) {
  const bookmakers = gameOdds.bookmakers || [];

  // Find best odds across all bookmakers
  let bestHomeML = { odds: 0, book: 'N/A' };
  let bestAwayML = { odds: 0, book: 'N/A' };
  let bestSpread = { line: 0, odds: -110, book: 'N/A' };
  let bestTotal = { line: 0, overOdds: -110, underOdds: -110, book: 'N/A' };

  bookmakers.forEach((bookmaker: any) => {
    const markets = bookmaker.markets || [];

    markets.forEach((market: any) => {
      if (market.key === 'h2h') {
        // Moneyline
        market.outcomes?.forEach((outcome: any) => {
          if (outcome.name === gameOdds.home_team) {
            if (outcome.price > bestHomeML.odds || bestHomeML.odds === 0) {
              bestHomeML = { odds: outcome.price, book: bookmaker.title };
            }
          } else {
            if (outcome.price > bestAwayML.odds || bestAwayML.odds === 0) {
              bestAwayML = { odds: outcome.price, book: bookmaker.title };
            }
          }
        });
      } else if (market.key === 'spreads') {
        // Spread
        const homeOutcome = market.outcomes?.find((o: any) => o.name === gameOdds.home_team);
        if (homeOutcome) {
          bestSpread = {
            line: Math.abs(homeOutcome.point || 0),
            odds: homeOutcome.price || -110,
            book: bookmaker.title,
          };
        }
      } else if (market.key === 'totals') {
        // Totals
        const overOutcome = market.outcomes?.find((o: any) => o.name === 'Over');
        const underOutcome = market.outcomes?.find((o: any) => o.name === 'Under');
        if (overOutcome) {
          bestTotal = {
            line: overOutcome.point || 0,
            overOdds: overOutcome.price || -110,
            underOdds: underOutcome?.price || -110,
            book: bookmaker.title,
          };
        }
      }
    });
  });

  return {
    id: gameOdds.id || '0',
    homeTeam: gameOdds.home_team || 'Home Team',
    awayTeam: gameOdds.away_team || 'Away Team',
    gameTime: gameOdds.commence_time
      ? new Date(gameOdds.commence_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      : 'TBD',
    bestOdds: {
      homeML: bestHomeML,
      awayML: bestAwayML,
      spread: bestSpread,
      total: bestTotal,
    },
    hasValue: false, // Would need prediction comparison to determine
    valueType: null as 'home' | 'away' | null,
  };
}

export default function OddsPage() {
  const { odds, meta, isLoading, isError, refresh } = useOdds();

  const formatOdds = (oddsValue: number) => (oddsValue > 0 ? `+${oddsValue}` : oddsValue.toString());

  // Transform odds data
  const transformedOdds = (odds || []).map(transformOddsData);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Best Available Odds</h1>
          <p className="text-slate-400 mt-1">
            Compare odds across sportsbooks and find the best lines
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-900/30 border-blue-800/50">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-blue-400" />
          <p className="text-sm text-blue-200">
            Odds are cached and updated every 15 minutes to conserve API quota.
            {meta?.remainingRequests && ` (${meta.remainingRequests} API requests remaining)`}
          </p>
        </CardContent>
      </Card>

      {/* Odds Cards */}
      <DataState
        isLoading={isLoading}
        isError={!!isError}
        isEmpty={transformedOdds.length === 0}
        onRetry={refresh}
        loadingMessage="Loading odds..."
        errorMessage="Failed to load odds"
        emptyMessage="No odds available"
        emptyDescription="Check back later for upcoming games"
      >
        <div className="space-y-4">
          {transformedOdds.map((game) => (
            <Card key={game.id} className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-400">{game.gameTime}</span>
                  </div>
                  {game.hasValue && (
                    <Badge variant="success" className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Value Available
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Teams */}
                <div className="flex items-center justify-between mb-6">
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold text-white">{game.awayTeam}</div>
                    <div className="text-xs text-slate-500">Away</div>
                  </div>
                  <div className="text-slate-500 text-xl">@</div>
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold text-white">{game.homeTeam}</div>
                    <div className="text-xs text-slate-500">Home</div>
                  </div>
                </div>

                {/* Odds Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Moneyline */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-xs text-slate-400 mb-2">Moneyline</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Away</span>
                        <div className="text-right">
                          <div
                            className={`font-bold ${
                              game.valueType === 'away' ? 'text-green-400' : 'text-white'
                            }`}
                          >
                            {game.bestOdds.awayML.odds !== 0
                              ? formatOdds(game.bestOdds.awayML.odds)
                              : '--'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {game.bestOdds.awayML.book}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Home</span>
                        <div className="text-right">
                          <div
                            className={`font-bold ${
                              game.valueType === 'home' ? 'text-green-400' : 'text-white'
                            }`}
                          >
                            {game.bestOdds.homeML.odds !== 0
                              ? formatOdds(game.bestOdds.homeML.odds)
                              : '--'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {game.bestOdds.homeML.book}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Spread */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-xs text-slate-400 mb-2">Spread</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Away</span>
                        <div className="text-right">
                          <div className="font-bold text-white">
                            {game.bestOdds.spread.line > 0
                              ? `+${game.bestOdds.spread.line} (${formatOdds(game.bestOdds.spread.odds)})`
                              : '--'}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Home</span>
                        <div className="text-right">
                          <div className="font-bold text-white">
                            {game.bestOdds.spread.line > 0
                              ? `-${game.bestOdds.spread.line} (${formatOdds(game.bestOdds.spread.odds)})`
                              : '--'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 text-right">
                        {game.bestOdds.spread.book}
                      </div>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-xs text-slate-400 mb-2">
                      Total: {game.bestOdds.total.line > 0 ? game.bestOdds.total.line : '--'}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Over</span>
                        <div className="font-bold text-white">
                          {game.bestOdds.total.overOdds
                            ? formatOdds(game.bestOdds.total.overOdds)
                            : '--'}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Under</span>
                        <div className="font-bold text-white">
                          {game.bestOdds.total.underOdds
                            ? formatOdds(game.bestOdds.total.underOdds)
                            : '--'}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 text-right">
                        {game.bestOdds.total.book}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DataState>
    </div>
  );
}
