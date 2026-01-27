'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { usePlayerProps, type PlayerPropResponse } from '@/hooks/usePlayerProps';
import { getPropTypeName, PropType } from '@/lib/predictions/props';
import { cn } from '@/lib/utils/cn';

interface PlayerPropCardProps {
  playerId: number;
  propType?: PropType;
  line?: number;
  opponentId?: number;
  isHome?: boolean;
  className?: string;
}

export function PlayerPropCard({
  playerId,
  propType = 'points',
  line,
  opponentId,
  isHome,
  className,
}: PlayerPropCardProps) {
  const { data, isLoading, isError } = usePlayerProps({
    playerId,
    propType,
    line,
    opponentId,
    isHome,
  });

  if (isLoading) {
    return (
      <Card className={cn('min-h-[200px] flex items-center justify-center', className)}>
        <Spinner />
      </Card>
    );
  }

  if (isError || !data || !data.player) {
    return (
      <Card className={cn('min-h-[200px] flex items-center justify-center', className)}>
        <p className="text-gray-500">Failed to load prop prediction</p>
      </Card>
    );
  }

  return <PlayerPropCardContent data={data} className={className} />;
}

interface PlayerPropCardContentProps {
  data: PlayerPropResponse;
  className?: string;
}

export function PlayerPropCardContent({ data, className }: PlayerPropCardContentProps) {
  const { player, propType, line, stats, prediction } = data;

  // Safety check for required data
  if (!player || !stats || !prediction) {
    return (
      <Card className={cn('min-h-[200px] flex items-center justify-center', className)}>
        <p className="text-gray-500">Invalid prop data</p>
      </Card>
    );
  }

  const getRecommendationStyle = (rec: 'over' | 'under' | 'pass') => {
    switch (rec) {
      case 'over':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'under':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '\u2191';
      case 'down':
        return '\u2193';
      default:
        return '\u2194';
    }
  };

  const formatProbability = (prob: number) => `${(prob * 100).toFixed(0)}%`;
  const formatValue = (val: number) => val.toFixed(1);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{player.name}</CardTitle>
            <p className="text-sm text-gray-500">
              {player.position} - {player.team.abbreviation}
            </p>
          </div>
          <Badge variant="info">{getPropTypeName(propType)}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Line and Prediction */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">Line</p>
            <p className="text-2xl font-bold">{formatValue(line)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">Predicted</p>
            <p className="text-2xl font-bold text-primary-600">
              {formatValue(prediction.predictedValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">Edge</p>
            <p
              className={cn(
                'text-lg font-semibold',
                prediction.edge > 0 ? 'text-green-600' : prediction.edge < 0 ? 'text-red-600' : 'text-gray-600'
              )}
            >
              {prediction.edge > 0 ? '+' : ''}
              {(prediction.edge * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Recommendation */}
        <div
          className={cn(
            'p-4 rounded-lg border-2 text-center',
            getRecommendationStyle(prediction.recommendation)
          )}
        >
          <p className="text-xs uppercase mb-1">Recommendation</p>
          <p className="text-xl font-bold uppercase">{prediction.recommendation}</p>
          <p className="text-sm mt-1">
            {formatProbability(prediction.confidence)} confidence
          </p>
        </div>

        {/* Probabilities */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase">Over</p>
            <p className="text-xl font-bold text-green-600">
              {formatProbability(prediction.overProbability)}
            </p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase">Under</p>
            <p className="text-xl font-bold text-red-600">
              {formatProbability(prediction.underProbability)}
            </p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-500">Season Avg</p>
            <p className="font-semibold">{formatValue(stats.seasonAverage)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Last {stats.recentGames}</p>
            <p className="font-semibold">
              {formatValue(stats.recentAverage)}
              <span className="ml-1">{getTrendIcon(stats.trend)}</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Games</p>
            <p className="font-semibold">{stats.gamesPlayed}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PlayerPropCard;
