'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  DollarSign,
  ExternalLink,
} from 'lucide-react';

interface GameCardProps {
  game: {
    id: string;
    homeTeam: { name: string; abbreviation: string; record: string };
    awayTeam: { name: string; abbreviation: string; record: string };
    gameTime: string;
    prediction: {
      homeWinProb: number;
      awayWinProb: number;
      spread: number;
      confidence: number;
      hasValue: boolean;
      valueBet: 'home' | 'away' | null;
    };
    odds: {
      homeML: number;
      awayML: number;
      spread: number;
      total: number;
    };
  };
}

export function GameCard({ game }: GameCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { homeTeam, awayTeam, prediction, odds, gameTime } = game;

  const homeWinPct = Math.round(prediction.homeWinProb * 100);
  const awayWinPct = Math.round(prediction.awayWinProb * 100);
  const confidencePct = Math.round(prediction.confidence * 100);

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const formatSpread = (spread: number) => {
    if (spread > 0) return `+${spread}`;
    return spread.toString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
      <CardContent className="p-0">
        {/* Main Content */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="h-4 w-4" />
              {gameTime}
            </div>

            <div className="flex items-center gap-2">
              {prediction.hasValue && (
                <Badge variant="success\" className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Value
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn('flex items-center gap-1', getConfidenceColor(prediction.confidence))}
              >
                <TrendingUp className="h-3 w-3" />
                {confidencePct}%
              </Badge>
            </div>
          </div>

          {/* Teams & Prediction */}
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Away Team */}
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{awayTeam.abbreviation}</div>
              <div className="text-sm text-slate-400">{awayTeam.record}</div>
              <div className={cn(
                'text-lg font-semibold mt-2',
                prediction.valueBet === 'away' ? 'text-green-400' : 'text-slate-300'
              )}>
                {awayWinPct}%
              </div>
            </div>

            {/* VS / Spread */}
            <div className="text-center">
              <div className="text-slate-500 text-sm">@</div>
              <div className="text-xl font-bold text-white mt-1">
                {formatSpread(prediction.spread)}
              </div>
              <div className="text-xs text-slate-500">Predicted Spread</div>
            </div>

            {/* Home Team */}
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{homeTeam.abbreviation}</div>
              <div className="text-sm text-slate-400">{homeTeam.record}</div>
              <div className={cn(
                'text-lg font-semibold mt-2',
                prediction.valueBet === 'home' ? 'text-green-400' : 'text-slate-300'
              )}>
                {homeWinPct}%
              </div>
            </div>
          </div>

          {/* Quick Odds */}
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="text-center">
              <div className="text-slate-500">ML</div>
              <div className="text-slate-300">{formatOdds(odds.awayML)} / {formatOdds(odds.homeML)}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-500">Spread</div>
              <div className="text-slate-300">{formatSpread(-odds.spread)} / {formatSpread(odds.spread)}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-500">Total</div>
              <div className="text-slate-300">O/U {odds.total}</div>
            </div>
          </div>
        </div>

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full border-t border-slate-700 px-4 py-2 flex items-center justify-center gap-2 text-sm text-slate-400 hover:bg-slate-700/50 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              View Details
            </>
          )}
        </button>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t border-slate-700 p-4 bg-slate-800/30">
            <h4 className="text-sm font-medium text-white mb-3">Prediction Factors</h4>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">ELO Difference</span>
                <span className="text-slate-300">+45 (Home favored)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recent Form (L10)</span>
                <span className="text-slate-300">7-3 vs 6-4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Home Court</span>
                <span className="text-slate-300">+3.2 points</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rest Advantage</span>
                <span className="text-slate-300">Even</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Link href={`/games/${game.id}`} className="flex-1">
                <Button variant="secondary" size="sm" className="w-full">
                  Full Analysis
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Button variant="primary" size="sm">
                Log Bet
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
