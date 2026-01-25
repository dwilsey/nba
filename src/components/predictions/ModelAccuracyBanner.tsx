'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { TrendingUp, Target, DollarSign, BarChart2, ArrowRight } from 'lucide-react';

// Mock data - will be replaced with actual API data
const mockAccuracy = {
  overallAccuracy: 0.583,
  vsClosingLine: 0.524,
  roiIfBetting: 0.042,
  totalPredictions: 847,
  currentStreak: 5,
  streakType: 'win',
};

export function ModelAccuracyBanner() {
  const { overallAccuracy, vsClosingLine, roiIfBetting, totalPredictions } = mockAccuracy;

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
                  {(overallAccuracy * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-400">Win Rate</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-400" />
              <div>
                <div className="text-lg font-bold text-white">
                  {(vsClosingLine * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-400">vs Vegas</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              <div>
                <div className="text-lg font-bold text-green-400">
                  +{(roiIfBetting * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-400">ROI</div>
              </div>
            </div>

            <div>
              <div className="text-lg font-bold text-white">{totalPredictions}</div>
              <div className="text-xs text-slate-400">Predictions</div>
            </div>
          </div>

          <Link
            href="/predictions"
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Details
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
