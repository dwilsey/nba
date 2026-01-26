import { NextRequest, NextResponse } from 'next/server';
import { nbaData, balldontlie } from '@/lib/api';
import prisma from '@/lib/db/prisma';
import { getCurrentNBASeason, getSeasonDateRange } from '@/lib/utils/season';

// Calculate team stats from historical games when database is empty
async function calculateStatsFromAPI(teamId: number, teamName: string) {
  try {
    const season = getCurrentNBASeason();
    const { start, end } = getSeasonDateRange(season);

    // Get games for this team from the current season
    const games = await balldontlie.getGames({
      teamIds: [teamId],
      startDate: start,
      endDate: new Date().toISOString().split('T')[0],
      perPage: 100,
    });

    // Filter to completed games only
    const completedGames = games.data.filter((g) => g.status === 'Final');

    if (completedGames.length === 0) {
      return null;
    }

    let wins = 0;
    let losses = 0;
    let homeWins = 0;
    let homeLosses = 0;
    let awayWins = 0;
    let awayLosses = 0;
    let totalPoints = 0;
    let totalOpponentPoints = 0;

    completedGames.forEach((game) => {
      const isHome = game.home_team.id === teamId;
      const teamScore = isHome ? game.home_team_score : game.visitor_team_score;
      const opponentScore = isHome ? game.visitor_team_score : game.home_team_score;
      const won = teamScore > opponentScore;

      totalPoints += teamScore;
      totalOpponentPoints += opponentScore;

      if (won) {
        wins++;
        if (isHome) homeWins++;
        else awayWins++;
      } else {
        losses++;
        if (isHome) homeLosses++;
        else awayLosses++;
      }
    });

    const gamesPlayed = completedGames.length;

    // Calculate last 10 games
    const last10Games = completedGames.slice(0, 10);
    let last10Wins = 0;
    let last10Losses = 0;
    last10Games.forEach((game) => {
      const isHome = game.home_team.id === teamId;
      const teamScore = isHome ? game.home_team_score : game.visitor_team_score;
      const opponentScore = isHome ? game.visitor_team_score : game.home_team_score;
      if (teamScore > opponentScore) last10Wins++;
      else last10Losses++;
    });

    // Calculate streak from most recent games
    let streak = 0;
    const sortedGames = [...completedGames].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (sortedGames.length > 0) {
      const firstGame = sortedGames[0];
      const isHome = firstGame.home_team.id === teamId;
      const firstWon =
        (isHome ? firstGame.home_team_score : firstGame.visitor_team_score) >
        (isHome ? firstGame.visitor_team_score : firstGame.home_team_score);
      const streakType = firstWon ? 'W' : 'L';

      for (const game of sortedGames) {
        const gameIsHome = game.home_team.id === teamId;
        const gameWon =
          (gameIsHome ? game.home_team_score : game.visitor_team_score) >
          (gameIsHome ? game.visitor_team_score : game.home_team_score);
        if ((gameWon && streakType === 'W') || (!gameWon && streakType === 'L')) {
          streak++;
        } else {
          break;
        }
      }
      if (streakType === 'L') streak = -streak;
    }

    return {
      wins,
      losses,
      homeWins,
      homeLosses,
      awayWins,
      awayLosses,
      winPct: gamesPlayed > 0 ? wins / gamesPlayed : 0,
      pointsPerGame: gamesPlayed > 0 ? totalPoints / gamesPlayed : 0,
      pointsAgainst: gamesPlayed > 0 ? totalOpponentPoints / gamesPlayed : 0,
      netRating:
        gamesPlayed > 0
          ? (totalPoints - totalOpponentPoints) / gamesPlayed
          : 0,
      streak,
      last10: `${last10Wins}-${last10Losses}`,
      last10Wins,
      last10Losses,
      atsWins: 0, // ATS data requires odds tracking
      atsLosses: 0,
      gamesPlayed,
    };
  } catch (error) {
    console.error(`Error calculating stats for team ${teamName}:`, error);
    return null;
  }
}

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

    // Try to get team stats from database first
    const teamStats = await prisma.teamStats.findMany({
      include: { team: true },
    });

    const statsMap = new Map(
      teamStats.map((ts) => [ts.team.externalId, ts])
    );

    // Check if we have any stats in the database
    const hasDbStats = teamStats.some(
      (ts) => ts.wins > 0 || ts.losses > 0
    );

    // Combine team data with stats
    const teamsWithStats = await Promise.all(
      teams.map(async (team) => {
        const dbStats = statsMap.get(team.id);

        // If database has real stats, use them
        if (dbStats && (dbStats.wins > 0 || dbStats.losses > 0)) {
          return {
            ...team,
            stats: {
              wins: dbStats.wins,
              losses: dbStats.losses,
              homeWins: dbStats.homeWins,
              homeLosses: dbStats.homeLosses,
              awayWins: dbStats.awayWins,
              awayLosses: dbStats.awayLosses,
              winPct:
                dbStats.wins + dbStats.losses > 0
                  ? dbStats.wins / (dbStats.wins + dbStats.losses)
                  : 0,
              pointsPerGame: dbStats.pointsPerGame,
              pointsAgainst: dbStats.pointsAgainst,
              netRating: dbStats.pointsPerGame - dbStats.pointsAgainst,
              streak: dbStats.streak,
              last10: `${dbStats.last10Wins}-${dbStats.last10Losses}`,
              last10Wins: dbStats.last10Wins,
              last10Losses: dbStats.last10Losses,
              atsWins: dbStats.atsWins,
              atsLosses: dbStats.atsLosses,
            },
          };
        }

        // Otherwise, calculate from API (only if database is empty)
        if (!hasDbStats) {
          const calculatedStats = await calculateStatsFromAPI(team.id, team.full_name);
          return {
            ...team,
            stats: calculatedStats,
          };
        }

        // Database has some stats but not for this team
        return {
          ...team,
          stats: null,
        };
      })
    );

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
        source: hasDbStats ? 'database' : 'api-calculated',
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
