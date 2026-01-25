'use client';

import { Badge } from '@/components/ui/Badge';
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ValueIndicatorProps {
  expectedValue: number;
  edge: number;
  recommendation: 'home' | 'away' | 'over' | 'under' | 'home_spread' | 'away_spread' | null;
  compact?: boolean;
}

export function ValueIndicator({
  expectedValue,
  edge,
  recommendation,
  compact = false,
}: ValueIndicatorProps) {
  const hasValue = expectedValue >= 0.03 && edge >= 0.05;

  if (!hasValue) {
    if (compact) return null;

    return (
      <div className="flex items-center gap-2 text-slate-500">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">No value detected</span>
      </div>
    );
  }

  const evPercent = (expectedValue * 100).toFixed(1);
  const edgePercent = (edge * 100).toFixed(1);

  const getRecommendationLabel = () => {
    switch (recommendation) {
      case 'home':
        return 'Home ML';
      case 'away':
        return 'Away ML';
      case 'home_spread':
        return 'Home Spread';
      case 'away_spread':
        return 'Away Spread';
      case 'over':
        return 'Over';
      case 'under':
        return 'Under';
      default:
        return 'Value Bet';
    }
  };

  const getTier = () => {
    if (expectedValue >= 0.10) return 'strong';
    if (expectedValue >= 0.05) return 'good';
    return 'slight';
  };

  const tier = getTier();

  if (compact) {
    return (
      <Badge
        variant="success"
        className={cn(
          'flex items-center gap-1',
          tier === 'strong' && 'bg-green-500/30 text-green-300',
          tier === 'good' && 'bg-green-500/20 text-green-400',
          tier === 'slight' && 'bg-green-500/10 text-green-500'
        )}
      >
        <DollarSign className="h-3 w-3" />
        +{evPercent}%
      </Badge>
    );
  }

  return (
    <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-green-500/20 rounded">
          <TrendingUp className="h-4 w-4 text-green-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">Value Bet Detected</div>
          <div className="text-xs text-green-400">{getRecommendationLabel()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-400 mb-1">Expected Value</div>
          <div className="text-lg font-bold text-green-400">+{evPercent}%</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">Edge vs Market</div>
          <div className="text-lg font-bold text-white">{edgePercent}%</div>
        </div>
      </div>
    </div>
  );
}
