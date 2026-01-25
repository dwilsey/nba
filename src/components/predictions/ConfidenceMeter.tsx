'use client';

import { cn } from '@/lib/utils/cn';

interface ConfidenceMeterProps {
  value: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ConfidenceMeter({ value, size = 'md', showLabel = true }: ConfidenceMeterProps) {
  const percentage = Math.round(value * 100);

  const getColor = () => {
    if (value >= 0.7) return 'bg-green-500';
    if (value >= 0.6) return 'bg-yellow-500';
    return 'bg-slate-500';
  };

  const getTextColor = () => {
    if (value >= 0.7) return 'text-green-400';
    if (value >= 0.6) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Confidence</span>
          <span className={cn('font-medium', getTextColor())}>{percentage}%</span>
        </div>
      )}
      <div className={cn('w-full bg-slate-700 rounded-full overflow-hidden', heights[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
