'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useBets, useAnalytics } from '@/hooks/useBets';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { BetForm } from '@/components/bets/BetForm';
import { Modal } from '@/components/ui/Modal';
import { DataState } from '@/components/ui/DataState';
import {
  Plus,
  TrendingUp,
  DollarSign,
  Trash2,
  RefreshCw,
} from 'lucide-react';

const betTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'MONEYLINE', label: 'Moneyline' },
  { value: 'SPREAD', label: 'Spread' },
  { value: 'TOTAL', label: 'Total' },
  { value: 'PARLAY', label: 'Parlay' },
];

const resultOptions = [
  { value: 'all', label: 'All Results' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'WIN', label: 'Won' },
  { value: 'LOSS', label: 'Lost' },
  { value: 'PUSH', label: 'Push' },
];

export default function MyBetsPage() {
  const { data: session } = useSession();
  const [showBetForm, setShowBetForm] = useState(false);
  const [betTypeFilter, setBetTypeFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');

  // Build filter options for API
  const betFilterOptions: { result?: string; oddsType?: string } = {};
  if (resultFilter !== 'all') betFilterOptions.result = resultFilter;
  if (betTypeFilter !== 'all') betFilterOptions.oddsType = betTypeFilter;

  const { bets, isLoading: betsLoading, isError: betsError, refresh: refreshBets } = useBets(betFilterOptions);
  const { analytics, isLoading: analyticsLoading, isError: analyticsError, refresh: refreshAnalytics } = useAnalytics();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <DollarSign className="h-16 w-16 text-slate-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Track Your Bets</h2>
        <p className="text-slate-400 mb-6 text-center max-w-md">
          Sign in to log your bets, track your performance, and analyze your betting history.
        </p>
        <Link href="/login">
          <Button>Sign In to Continue</Button>
        </Link>
      </div>
    );
  }

  const formatOdds = (odds: number) => (odds > 0 ? `+${odds}` : odds.toString());

  const getResultBadge = (result: string) => {
    switch (result?.toUpperCase()) {
      case 'WIN':
        return <Badge variant="success">Won</Badge>;
      case 'LOSS':
        return <Badge variant="danger">Lost</Badge>;
      case 'PUSH':
        return <Badge variant="warning">Push</Badge>;
      case 'VOID':
        return <Badge variant="default">Void</Badge>;
      default:
        return <Badge variant="default">Pending</Badge>;
    }
  };

  const handleRefresh = () => {
    refreshBets();
    refreshAnalytics();
  };

  // Use real analytics or fallback defaults
  const stats = analytics || {
    totalBets: 0,
    totalWagered: 0,
    totalProfit: 0,
    winRate: 0,
    roi: 0,
  };

  const isLoading = betsLoading || analyticsLoading;
  const isError = betsError || analyticsError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Bets</h1>
          <p className="text-slate-400 mt-1">Track and analyze your betting performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowBetForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Bet
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">Total Bets</p>
            <p className="text-2xl font-bold text-white">{stats.totalBets}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">Total Wagered</p>
            <p className="text-2xl font-bold text-white">
              ${(stats.totalWagered || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">Total Profit</p>
            <p
              className={`text-2xl font-bold ${
                (stats.totalProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {(stats.totalProfit || 0) >= 0 ? '+' : ''}$
              {(stats.totalProfit || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">Win Rate</p>
            <p className="text-2xl font-bold text-white">
              {((stats.winRate || 0) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">ROI</p>
            <p
              className={`text-2xl font-bold ${
                (stats.roi || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {(stats.roi || 0) >= 0 ? '+' : ''}
              {((stats.roi || 0) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select
          options={betTypeOptions}
          value={betTypeFilter}
          onChange={(e) => setBetTypeFilter(e.target.value)}
          className="w-40 bg-slate-800 border-slate-700"
        />
        <Select
          options={resultOptions}
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="w-40 bg-slate-800 border-slate-700"
        />
        <Link href="/my-bets/analytics" className="ml-auto">
          <Button variant="secondary">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </Link>
      </div>

      {/* Bets Table */}
      <DataState
        isLoading={isLoading}
        isError={!!isError}
        isEmpty={(bets || []).length === 0}
        onRetry={handleRefresh}
        loadingMessage="Loading your bets..."
        errorMessage="Failed to load bets"
        emptyMessage="No bets found"
        emptyDescription="Click 'Log Bet' to start tracking your bets"
      >
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Game
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Odds
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Book
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Result
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Profit
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {(bets || []).map((bet: any) => (
                    <tr
                      key={bet.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30"
                    >
                      <td className="py-3 px-4 text-sm text-slate-400">
                        {bet.gameDate
                          ? new Date(bet.gameDate).toLocaleDateString()
                          : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{bet.team}</div>
                        <div className="text-xs text-slate-500">vs {bet.opponent}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="capitalize">
                          {(bet.oddsType || bet.betType || 'unknown').toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-white">{formatOdds(bet.odds || 0)}</td>
                      <td className="py-3 px-4 text-white">${bet.amount || 0}</td>
                      <td className="py-3 px-4 text-slate-400">{bet.sportsbook || '--'}</td>
                      <td className="py-3 px-4">{getResultBadge(bet.result)}</td>
                      <td className="py-3 px-4">
                        {bet.profit !== null && bet.profit !== undefined ? (
                          <span
                            className={bet.profit >= 0 ? 'text-green-400' : 'text-red-400'}
                          >
                            {bet.profit >= 0 ? '+' : ''}${bet.profit.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </DataState>

      {/* Bet Form Modal */}
      <Modal
        isOpen={showBetForm}
        onClose={() => setShowBetForm(false)}
        title="Log New Bet"
        size="lg"
      >
        <BetForm
          onSuccess={() => {
            setShowBetForm(false);
            handleRefresh();
          }}
        />
      </Modal>
    </div>
  );
}
