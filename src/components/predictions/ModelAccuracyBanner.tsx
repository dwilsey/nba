'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { TrendingUp, Target, DollarSign, BarChart2, ArrowRight, Loader2 } from 'lucide-react';
import { usePredictionAccuracy } from '@/hooks/usePredictions';
import { getCurrentNBASeason } from '@/lib/utils/season';

export function ModelAccuracyBanner() {
  const currentSeason = getCurrentNBASeason();
  const { accuracy, isLoading } = usePredictionAccuracy(currentSeason);

  // Use real data if available, otherwise use placeholder values
  const overallAccuracy = accuracy?.overall?.accuracy || 0;
  const vsClosingLine = accuracy?.vsVegas?.accuracy || 0;
  const roiIfBetting = accuracy?.roi?.value || 0;
  const totalPredictions = accuracy?.overall?.totalPredictions || 0;

  // Show loading state
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-blue-900/50 to-slate-800 border-blue-800/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading model performance...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show placeholder when no predictions yet
  const hasData = totalPredictions > 0;

  return (
    <Card className="bg-gradient-to-r from-blue-900/50 to-slate-800 border-blue-800/50">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Target className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Model Performance</h3>
              <p className="text-sm text-slate-400">Season 2024-25 Results</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <div>
                <div className="text-lg font-bold text-white">
                  {hasData ? `${(overallAccuracy * 100).toFixed(1)}%` : '--'}
                </div>
                <div className="text-xs text-slate-400">Win Rate</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-400" />
              <div>
                <div className="text-lg font-bold text-white">
                  {hasData ? `${(vsClosingLine * 100).toFixed(1)}%` : '--'}
                </div>
                <div className="text-xs text-slate-400">vs Vegas</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              <div>
                <div className={`text-lg font-bold ${roiIfBetting >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {hasData ? `${roiIfBetting >= 0 ? '+' : ''}${(roiIfBetting * 100).toFixed(1)}%` : '--'}
                </div>
                <div className="text-xs text-slate-400">ROI</div>
              </div>
            </div>

            <div>
              <div className="text-lg font-bold text-white">{totalPredictions}</div>
              <div className="text-xs text-slate-400">Predictions</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/predictions"
              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View Stats
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/predictions/results"
              className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              View Results
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
