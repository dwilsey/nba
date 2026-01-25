'use client';

import { useState } from 'react';
import { useTeams } from '@/hooks/useTeams';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataState } from '@/components/ui/DataState';
import { Search, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const conferenceOptions = [
  { value: 'all', label: 'All Teams' },
  { value: 'east', label: 'Eastern Conference' },
  { value: 'west', label: 'Western Conference' },
];

const sortOptions = [
  { value: 'winPct', label: 'Win %' },
  { value: 'netRating', label: 'Net Rating' },
  { value: 'ppg', label: 'Points Per Game' },
  { value: 'atsRecord', label: 'ATS Record' },
];

// Transform API team data to display format
function transformTeamData(team: any) {
  const stats = team.stats || {};
  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const totalGames = wins + losses;
  const winPct = totalGames > 0 ? wins / totalGames : 0;

  return {
    id: team.id || team.externalId,
    name: team.full_name || team.name || 'Unknown Team',
    abbreviation: team.abbreviation || '???',
    conference: team.conference || 'Unknown',
    division: team.division || 'Unknown',
    record: totalGames > 0 ? `${wins}-${losses}` : '--',
    winPct,
    homeRecord: stats.homeWins && stats.homeLosses ? `${stats.homeWins}-${stats.homeLosses}` : '--',
    awayRecord: stats.awayWins && stats.awayLosses ? `${stats.awayWins}-${stats.awayLosses}` : '--',
    streak: stats.streak || '--',
    last10: stats.last10 || '--',
    ppg: stats.pointsPerGame || stats.ppg || 0,
    oppPpg: stats.opponentPointsPerGame || stats.oppPpg || 0,
    netRating: stats.netRating || (stats.pointsPerGame && stats.opponentPointsPerGame
      ? (stats.pointsPerGame - stats.opponentPointsPerGame).toFixed(1)
      : 0),
    atsRecord: stats.atsWins && stats.atsLosses ? `${stats.atsWins}-${stats.atsLosses}` : '--',
    ouRecord: stats.overRecord && stats.underRecord ? `${stats.overRecord}-${stats.underRecord}` : '--',
  };
}

export default function StatsPage() {
  const [search, setSearch] = useState('');
  const [conference, setConference] = useState('all');
  const [sortBy, setSortBy] = useState('winPct');

  const { teams, isLoading, isError, refresh } = useTeams({
    conference: conference as 'east' | 'west' | 'all',
  });

  // Transform and filter teams
  const transformedTeams = (teams || []).map(transformTeamData);

  const filteredTeams = transformedTeams
    .filter((team) => {
      if (search && !team.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'winPct') return b.winPct - a.winPct;
      if (sortBy === 'netRating') return Number(b.netRating) - Number(a.netRating);
      if (sortBy === 'ppg') return b.ppg - a.ppg;
      return 0;
    });

  const getStreakBadge = (streak: string) => {
    if (streak === '--') {
      return <Badge variant="default">{streak}</Badge>;
    }
    if (streak.startsWith('W')) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {streak}
        </Badge>
      );
    }
    if (streak.startsWith('L')) {
      return (
        <Badge variant="danger" className="flex items-center gap-1">
          <TrendingDown className="h-3 w-3" />
          {streak}
        </Badge>
      );
    }
    return <Badge variant="default">{streak}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Statistics</h1>
          <p className="text-slate-400 mt-1">
            Comprehensive team stats including betting trends
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>
        <Select
          options={conferenceOptions}
          value={conference}
          onChange={(e) => setConference(e.target.value)}
          className="w-48 bg-slate-800 border-slate-700"
        />
        <Select
          options={sortOptions}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-40 bg-slate-800 border-slate-700"
        />
      </div>

      {/* Teams Table */}
      <DataState
        isLoading={isLoading}
        isError={!!isError}
        isEmpty={filteredTeams.length === 0}
        onRetry={refresh}
        loadingMessage="Loading team statistics..."
        errorMessage="Failed to load team statistics"
        emptyMessage="No teams found"
        emptyDescription="Try adjusting your search or filters"
      >
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Team
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      Record
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      Win %
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      Home
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      Away
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      L10
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      Streak
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      PPG
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      Opp PPG
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      Net Rtg
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      ATS
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                      O/U
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map((team, idx) => (
                    <tr
                      key={team.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-sm w-6">{idx + 1}</span>
                          <div>
                            <div className="font-medium text-white">{team.name}</div>
                            <div className="text-xs text-slate-500">
                              {team.conference} - {team.division}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 text-white font-medium">
                        {team.record}
                      </td>
                      <td className="text-center py-3 px-4 text-white">
                        {(team.winPct * 100).toFixed(1)}%
                      </td>
                      <td className="text-center py-3 px-4 text-slate-300">
                        {team.homeRecord}
                      </td>
                      <td className="text-center py-3 px-4 text-slate-300">
                        {team.awayRecord}
                      </td>
                      <td className="text-center py-3 px-4 text-slate-300">{team.last10}</td>
                      <td className="text-center py-3 px-4">{getStreakBadge(team.streak)}</td>
                      <td className="text-center py-3 px-4 text-white">
                        {team.ppg > 0 ? team.ppg.toFixed(1) : '--'}
                      </td>
                      <td className="text-center py-3 px-4 text-slate-300">
                        {team.oppPpg > 0 ? team.oppPpg.toFixed(1) : '--'}
                      </td>
                      <td className="text-center py-3 px-4">
                        <span
                          className={
                            Number(team.netRating) > 0
                              ? 'text-green-400'
                              : Number(team.netRating) < 0
                                ? 'text-red-400'
                                : 'text-slate-300'
                          }
                        >
                          {Number(team.netRating) > 0 ? '+' : ''}
                          {team.netRating}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-slate-300">{team.atsRecord}</td>
                      <td className="text-center py-3 px-4 text-slate-300">{team.ouRecord}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </DataState>
    </div>
  );
}
