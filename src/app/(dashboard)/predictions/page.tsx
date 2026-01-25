'use client';

import { usePredictionAccuracy } from '@/hooks/usePredictions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataState } from '@/components/ui/DataState';
import {
  Target,
  BarChart2,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { getCurrentNBASeason, formatSeasonDisplay } from '@/lib/utils/season';

// Default stats when API returns no data
const defaultStats = {
  overall: {
    accuracy: 0,
    totalPredictions: 0,
    correct: 0,
    incorrect: 0,
  },
  vsVegas: {
    accuracy: 0,
    better: 0,
    worse: 0,
  },
  roi: {
    value: 0,
    totalWagered: 0,
    totalProfit: 0,
  },
  byMonth: [] as { month: string; accuracy: number; predictions: number }[],
  byBetType: [] as { type: string; accuracy: number; predictions: number }[],
  recentPredictions: [] as {
    game: string;
    prediction: string;
    result: string;
    confidence: number;
  }[],
};

export default function PredictionsPage() {
  const currentSeason = getCurrentNBASeason();
  const { accuracy, isLoading, isError, refresh } = usePredictionAccuracy(currentSeason);

  // Use real data if available, otherwise use defaults
  const stats = accuracy || defaultStats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Model Performance</h1>
          <p className="text-slate-400 mt-1">
            Track prediction accuracy and validate the model ({formatSeasonDisplay(currentSeason)}{' '}
            season)
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <DataState
        isLoading={isLoading}
        isError={!!isError}
        isEmpty={stats.overall.totalPredictions === 0}
        onRetry={refresh}
        loadingMessage="Loading model statistics..."
        errorMessage="Failed to load model statistics"
        emptyMessage="No predictions yet"
        emptyDescription="Model statistics will appear once games have been predicted"
      >
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Target className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Overall Accuracy</p>
                    <p className="text-2xl font-bold text-white">
                      {(stats.overall.accuracy * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {stats.overall.correct}/{stats.overall.totalPredictions}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <BarChart2 className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">vs Vegas Closing</p>
                    <p className="text-2xl font-bold text-white">
                      {(stats.vsVegas.accuracy * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500">Beat closing line</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <DollarSign className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Theoretical ROI</p>
                    <p
                      className={`text-2xl font-bold ${
                        stats.roi.value >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {stats.roi.value >= 0 ? '+' : ''}
                      {(stats.roi.value * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500">If betting all picks</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Calendar className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Total Predictions</p>
                    <p className="text-2xl font-bold text-white">
                      {stats.overall.totalPredictions}
                    </p>
                    <p className="text-xs text-slate-500">This season</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accuracy by Month */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Accuracy by Month</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.byMonth.length > 0 ? (
                  <div className="space-y-3">
                    {stats.byMonth.map((month) => (
                      <div key={month.month} className="flex items-center gap-4">
                        <div className="w-12 text-sm text-slate-400">{month.month}</div>
                        <div className="flex-1 bg-slate-700 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                            style={{ width: `${month.accuracy * 100}%` }}
                          />
                        </div>
                        <div className="w-16 text-right text-sm text-white">
                          {(month.accuracy * 100).toFixed(1)}%
                        </div>
                        <div className="w-12 text-right text-xs text-slate-500">
                          n={month.predictions}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">
                    No monthly data available yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Accuracy by Bet Type */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Accuracy by Bet Type</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.byBetType.length > 0 ? (
                  <div className="space-y-4">
                    {stats.byBetType.map((type) => (
                      <div key={type.type} className="p-4 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white">{type.type}</span>
                          <Badge variant={type.accuracy >= 0.55 ? 'success' : 'default'}>
                            {(type.accuracy * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="bg-slate-600 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${
                              type.accuracy >= 0.55 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${type.accuracy * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {type.predictions} predictions
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">
                    No bet type data available yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Predictions */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentPredictions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                          Game
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                          Prediction
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                          Confidence
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentPredictions.map((pred, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50">
                          <td className="py-3 px-4 text-white">{pred.game}</td>
                          <td className="py-3 px-4 text-white font-medium">{pred.prediction}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline">
                              {(pred.confidence * 100).toFixed(0)}%
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {pred.result === 'correct' ? (
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle className="h-4 w-4" />
                                Correct
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="h-4 w-4" />
                                Incorrect
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">No recent predictions available</p>
              )}
            </CardContent>
          </Card>
        </>
      </DataState>
    </div>
  );
}
