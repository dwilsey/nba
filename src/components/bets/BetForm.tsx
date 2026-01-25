'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const betSchema = z.object({
  team: z.string().min(1, 'Team is required'),
  opponent: z.string().min(1, 'Opponent is required'),
  betType: z.enum(['moneyline', 'spread', 'total', 'player_prop']),
  odds: z.number().min(-10000).max(10000),
  amount: z.number().min(0.01, 'Amount must be positive'),
  sportsbook: z.string().min(1, 'Sportsbook is required'),
  gameDate: z.string().min(1, 'Game date is required'),
  notes: z.string().optional(),
  // Player prop fields
  playerName: z.string().optional(),
  propType: z.string().optional(),
  propLine: z.number().optional(),
});

type BetFormData = z.infer<typeof betSchema>;

interface BetFormProps {
  onSuccess: () => void;
}

const betTypeOptions = [
  { value: 'moneyline', label: 'Moneyline' },
  { value: 'spread', label: 'Spread' },
  { value: 'total', label: 'Over/Under' },
  { value: 'player_prop', label: 'Player Prop' },
];

const sportsbookOptions = [
  { value: 'draftkings', label: 'DraftKings' },
  { value: 'fanduel', label: 'FanDuel' },
  { value: 'betmgm', label: 'BetMGM' },
  { value: 'caesars', label: 'Caesars' },
  { value: 'pointsbet', label: 'PointsBet' },
  { value: 'other', label: 'Other' },
];

const propTypeOptions = [
  { value: 'points', label: 'Points' },
  { value: 'rebounds', label: 'Rebounds' },
  { value: 'assists', label: 'Assists' },
  { value: 'threes', label: '3-Pointers Made' },
  { value: 'pra', label: 'Pts + Reb + Ast' },
  { value: 'pr', label: 'Pts + Reb' },
  { value: 'pa', label: 'Pts + Ast' },
];

export function BetForm({ onSuccess }: BetFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [betType, setBetType] = useState('moneyline');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BetFormData>({
    resolver: zodResolver(betSchema),
    defaultValues: {
      betType: 'moneyline',
      gameDate: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (data: BetFormData) => {
    setIsLoading(true);
    try {
      // API call would go here
      console.log('Submitting bet:', data);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onSuccess();
    } catch (error) {
      console.error('Failed to submit bet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Your Pick"
          placeholder="e.g., Boston Celtics"
          error={errors.team?.message}
          {...register('team')}
        />
        <Input
          label="Opponent"
          placeholder="e.g., Los Angeles Lakers"
          error={errors.opponent?.message}
          {...register('opponent')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Bet Type"
          options={betTypeOptions}
          error={errors.betType?.message}
          {...register('betType')}
          onChange={(e) => {
            setBetType(e.target.value);
            setValue('betType', e.target.value as BetFormData['betType']);
          }}
        />
        <Select
          label="Sportsbook"
          options={sportsbookOptions}
          error={errors.sportsbook?.message}
          {...register('sportsbook')}
        />
      </div>

      {betType === 'player_prop' && (
        <div className="space-y-4 p-4 bg-slate-700/50 rounded-lg">
          <h4 className="text-sm font-medium text-white">Player Prop Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Player Name"
              placeholder="e.g., LeBron James"
              error={errors.playerName?.message}
              {...register('playerName')}
            />
            <Select
              label="Prop Type"
              options={propTypeOptions}
              {...register('propType')}
            />
          </div>
          <Input
            label="Line"
            type="number"
            step="0.5"
            placeholder="e.g., 25.5"
            {...register('propLine', { valueAsNumber: true })}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Odds"
          type="number"
          placeholder="-110"
          error={errors.odds?.message}
          {...register('odds', { valueAsNumber: true })}
        />
        <Input
          label="Amount ($)"
          type="number"
          step="0.01"
          placeholder="100"
          error={errors.amount?.message}
          {...register('amount', { valueAsNumber: true })}
        />
        <Input
          label="Game Date"
          type="date"
          error={errors.gameDate?.message}
          {...register('gameDate')}
        />
      </div>

      <Input
        label="Notes (optional)"
        placeholder="Any additional notes..."
        {...register('notes')}
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" isLoading={isLoading}>
          Log Bet
        </Button>
      </div>
    </form>
  );
}
