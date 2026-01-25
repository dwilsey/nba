import { NextRequest, NextResponse } from 'next/server';
import { nbaData } from '@/lib/api';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conference = searchParams.get('conference');

    // Get teams from API
    let teams = await nbaData.getTeams();

    // Filter by conference if specified
    if (conference && conference !== 'all') {
      teams = teams.filter(
        (t) => t.conference.toLowerCase() === conference.toLowerCase()
      );
    }

    // Get team stats from database
    const teamStats = await prisma.teamStats.findMany({
      include: { team: true },
    });

    const statsMap = new Map(
      teamStats.map((ts) => [ts.team.externalId, ts])
    );

    // Combine team data with stats
    const teamsWithStats = teams.map((team) => {
      const stats = statsMap.get(team.id);

      return {
        ...team,
        stats: stats
          ? {
              wins: stats.wins,
              losses: stats.losses,
              homeWins: stats.homeWins,
              homeLosses: stats.homeLosses,
              awayWins: stats.awayWins,
              awayLosses: stats.awayLosses,
              winPct: stats.wins + stats.losses > 0
                ? stats.wins / (stats.wins + stats.losses)
                : 0,
              pointsPerGame: stats.pointsPerGame,
              pointsAgainst: stats.pointsAgainst,
              netRating: stats.pointsPerGame - stats.pointsAgainst,
              streak: stats.streak,
              last10Wins: stats.last10Wins,
              last10Losses: stats.last10Losses,
              atsWins: stats.atsWins,
              atsLosses: stats.atsLosses,
            }
          : null,
      };
    });

    // Sort by win percentage
    teamsWithStats.sort((a, b) => {
      const aWinPct = a.stats?.winPct || 0;
      const bWinPct = b.stats?.winPct || 0;
      return bWinPct - aWinPct;
    });

    return NextResponse.json({
      data: teamsWithStats,
      meta: {
        count: teamsWithStats.length,
      },
    });
  } catch (error) {
    console.error('Error fetching team stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team stats' },
      { status: 500 }
    );
  }
}
