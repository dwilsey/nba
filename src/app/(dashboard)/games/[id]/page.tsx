'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataState } from '@/components/ui/DataState';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Home,
  Plane,
  Calendar,
  Activity,
  Target,
  DollarSign,
  BarChart2,
  Clock,
  Minus,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GameDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, error, isLoading, mutate } = useSWR(`/api/games/${id}`, fetcher);

  const game = data?.data;
  const prediction = game?.prediction;
  const factors = prediction?.factors;
  const odds = game?.odds;

  const formatOdds = (value: number) => {
    return value > 0 ? `+${value}` : value.toString();
  };

  const formatSpread = (spread: number) => {
    if (spread > 0) return `+${spread.toFixed(1)}`;
    return spread.toFixed(1);
  };

  const getFactorIcon = (value: number) => {
    if (value > 0.05) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (value < -0.05) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-slate-400" />;
  };

  const getFactorLabel = (value: number) => {
    if (value > 0.05) return 'Favors Home';
    if (value < -0.05) return 'Favors Away';
    return 'Neutral';
  };

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/games"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Games
      </Link>

      <DataState
        isLoading={isLoading}
        isError={!!error}
        isEmpty={!game}
        onRetry={() => mutate()}
        loadingMessage="Loading game analysis..."
        errorMessage="Failed to load game"
        emptyMessage="Game not found"
      >
        {game && (
          <>
            {/* Header */}
            <Card className="bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  {/* Teams */}
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white">
                        {game.visitor_team?.abbreviation}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {game.visitor_team?.full_name}
                      </div>
                      {prediction && (
                        <div className="text-lg font-semibold text-slate-300 mt-2">
                          {(prediction.awayWinProbability * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>

                    <div className="text-center">
                      <div className="text-slate-500 text-lg">@</div>
                      {game.status === 'Final' ? (
                        <div className="text-xl font-bold text-white">
                          {game.visitor_team_score} - {game.home_team_score}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">
                          {new Date(game.date).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="text-center">
                      <div className="text-3xl font-bold text-white">
                        {game.home_team?.abbreviation}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {game.home_team?.full_name}
                      </div>
                      {prediction && (
                        <div className="text-lg font-semibold text-slate-300 mt-2">
                          {(prediction.homeWinProbability * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prediction Summary */}
                  {prediction && (
                    <div className="flex items-center gap-4">
                      <div className="text-center px-4 py-2 bg-slate-700/50 rounded-lg">
                        <div className="text-sm text-slate-400">Predicted Winner</div>
                        <div className="text-lg font-bold text-white">
                          {prediction.predictedWinner}
                        </div>
                      </div>
                      <div className="text-center px-4 py-2 bg-slate-700/50 rounded-lg">
                        <div className="text-sm text-slate-400">Confidence</div>
                        <Badge
                          variant={
                            prediction.confidence >= 0.7
                              ? 'success'
                              : prediction.confidence >= 0.6
                              ? 'warning'
                              : 'default'
                          }
                          className="text-lg"
                        >
                          {(prediction.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="text-center px-4 py-2 bg-slate-700/50 rounded-lg">
                        <div className="text-sm text-slate-400">Predicted Spread</div>
                        <div className="text-lg font-bold text-white">
                          {formatSpread(prediction.spreadPrediction || 0)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Prediction Factors */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-blue-400" />
                    Prediction Factors
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {factors ? (
                    <>
                      {/* ELO Difference */}
                      <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Target className="h-5 w-5 text-purple-400" />
                          <div>
                            <div className="font-medium text-white">ELO Rating</div>
                            <div className="text-sm text-slate-400">
                              Historical team strength
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {factors.eloDifference?.homeElo?.toFixed(0) || 1500} vs{' '}
                            {factors.eloDifference?.awayElo?.toFixed(0) || 1500}
                          </div>
                          <div className="text-sm text-slate-400">
                            Diff: {formatSpread(factors.eloDifference?.value || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Recent Form */}
                      <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Activity className="h-5 w-5 text-green-400" />
                          <div>
                            <div className="font-medium text-white">Recent Form (L10)</div>
                            <div className="text-sm text-slate-400">
                              Last 10 games performance
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {factors.recentForm?.homeL10
                              ? `${factors.recentForm.homeL10.wins}-${factors.recentForm.homeL10.losses}`
                              : '5-5'}{' '}
                            vs{' '}
                            {factors.recentForm?.awayL10
                              ? `${factors.recentForm.awayL10.wins}-${factors.recentForm.awayL10.losses}`
                              : '5-5'}
                          </div>
                          <div className="flex items-center gap-1 justify-end text-sm">
                            {getFactorIcon(factors.recentForm?.value || 0)}
                            <span className="text-slate-400">
                              {getFactorLabel(factors.recentForm?.value || 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Home Court */}
                      <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Home className="h-5 w-5 text-blue-400" />
                          <div>
                            <div className="font-medium text-white">Home Court</div>
                            <div className="text-sm text-slate-400">
                              Home team advantage
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {factors.homeCourt?.isNeutral
                              ? 'Neutral Site'
                              : `+${((factors.homeCourt?.advantage || 100) / 25).toFixed(1)} pts`}
                          </div>
                          <div className="flex items-center gap-1 justify-end text-sm">
                            <TrendingUp className="h-4 w-4 text-green-400" />
                            <span className="text-slate-400">Favors Home</span>
                          </div>
                        </div>
                      </div>

                      {/* Rest Advantage */}
                      <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-yellow-400" />
                          <div>
                            <div className="font-medium text-white">Rest Advantage</div>
                            <div className="text-sm text-slate-400">
                              Days since last game
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {factors.restAdvantage?.homeDaysRest ?? 1} days vs{' '}
                            {factors.restAdvantage?.awayDaysRest ?? 1} days
                          </div>
                          <div className="flex items-center gap-1 justify-end text-sm">
                            {factors.restAdvantage?.homeBackToBack && (
                              <Badge variant="warning" className="text-xs">
                                Home B2B
                              </Badge>
                            )}
                            {factors.restAdvantage?.awayBackToBack && (
                              <Badge variant="warning" className="text-xs">
                                Away B2B
                              </Badge>
                            )}
                            {!factors.restAdvantage?.homeBackToBack &&
                              !factors.restAdvantage?.awayBackToBack && (
                                <>
                                  {getFactorIcon(factors.restAdvantage?.value || 0)}
                                  <span className="text-slate-400">
                                    {getFactorLabel(factors.restAdvantage?.value || 0)}
                                  </span>
                                </>
                              )}
                          </div>
                        </div>
                      </div>

                      {/* Head to Head */}
                      {factors.headToHead &&
                        (factors.headToHead.homeWins > 0 || factors.headToHead.awayWins > 0) && (
                          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <TrendingUp className="h-5 w-5 text-orange-400" />
                              <div>
                                <div className="font-medium text-white">Head-to-Head</div>
                                <div className="text-sm text-slate-400">
                                  Season matchups
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-white">
                                {factors.headToHead.homeWins}-{factors.headToHead.awayWins}
                              </div>
                              <div className="flex items-center gap-1 justify-end text-sm">
                                {getFactorIcon(factors.headToHead.value)}
                                <span className="text-slate-400">
                                  {getFactorLabel(factors.headToHead.value)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                      {/* Travel */}
                      {factors.travel && factors.travel.awayTravelMiles > 0 && (
                        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Plane className="h-5 w-5 text-cyan-400" />
                            <div>
                              <div className="font-medium text-white">Travel Distance</div>
                              <div className="text-sm text-slate-400">
                                Away team travel impact
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">
                              {Math.round(factors.travel.awayTravelMiles).toLocaleString()} miles
                            </div>
                            <div className="flex items-center gap-1 justify-end text-sm">
                              {getFactorIcon(factors.travel.value)}
                              <span className="text-slate-400">
                                {getFactorLabel(factors.travel.value)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-400 text-center py-4">
                      No prediction factors available
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Odds & Value Analysis */}
              <div className="space-y-6">
                {/* Current Odds */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-400" />
                      Current Odds
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {odds ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">Moneyline</div>
                          <div className="text-white">
                            <div>{game.visitor_team?.abbreviation}: {formatOdds(odds.awayMoneyline)}</div>
                            <div>{game.home_team?.abbreviation}: {formatOdds(odds.homeMoneyline)}</div>
                          </div>
                        </div>
                        <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">Spread</div>
                          <div className="text-white">
                            <div>{game.visitor_team?.abbreviation}: {formatSpread(-odds.spread)}</div>
                            <div>{game.home_team?.abbreviation}: {formatSpread(odds.spread)}</div>
                          </div>
                        </div>
                        <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">Total</div>
                          <div className="text-white text-lg font-semibold">
                            O/U {odds.total}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-center py-4">No odds available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recommendation */}
                {prediction && (
                  <Card className="bg-gradient-to-br from-blue-900/50 to-slate-800 border-blue-800/50">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-400" />
                        Model Recommendation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="text-lg font-semibold text-white mb-2">
                          {prediction.predictedWinner} to Win
                        </div>
                        <div className="text-sm text-slate-400">
                          The model predicts {prediction.predictedWinner} with{' '}
                          {(prediction.confidence * 100).toFixed(0)}% confidence based on ELO
                          ratings and situational factors.
                        </div>
                      </div>

                      {prediction.spreadPrediction && odds && (
                        <div className="p-4 bg-slate-800/50 rounded-lg">
                          <div className="text-lg font-semibold text-white mb-2">
                            Spread Analysis
                          </div>
                          <div className="text-sm text-slate-400">
                            <p>
                              Model Spread:{' '}
                              <span className="text-white font-medium">
                                {formatSpread(prediction.spreadPrediction)}
                              </span>
                            </p>
                            <p>
                              Vegas Spread:{' '}
                              <span className="text-white font-medium">
                                {formatSpread(odds.spread)}
                              </span>
                            </p>
                            {Math.abs(prediction.spreadPrediction - odds.spread) >= 2 && (
                              <p className="mt-2 text-yellow-400">
                                Line value detected ({(prediction.spreadPrediction - odds.spread).toFixed(1)} point difference)
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <Button variant="primary" className="w-full">
                        Log Bet
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
