import { NextRequest, NextResponse } from 'next/server';
import { nbaData, balldontlie } from '@/lib/api';
import prisma from '@/lib/db/prisma';
import { getCurrentNBASeason, getSeasonDateRange } from '@/lib/utils/season';
import { isCurrentNBATeam } from '@/lib/utils/teams';
import { Game } from '@/types';

// Helper for rate limiting between API calls
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Default stats for teams with no data
const DEFAULT_STATS = {
  wins: 0,
  losses: 0,
  homeWins: 0,
  homeLosses: 0,
  awayWins: 0,
  awayLosses: 0,
  winPct: 0,
  pointsPerGame: 0,
  pointsAgainst: 0,
  opponentPointsPerGame: 0,
  netRating: 0,
  streak: '--',
  last10: '0-0',
  last10Wins: 0,
  last10Losses: 0,
  atsWins: 0,
  atsLosses: 0,
  gamesPlayed: 0,
};

// In-memory cache for all season games (to avoid repeated API calls)
let cachedGames: Game[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Fetch all season games with pagination (one-time fetch, then cache)
async function fetchAllSeasonGames(): Promise<Game[]> {
  // Return cached games if still valid
  if (cachedGames && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log(`Using cached games: ${cachedGames.length} games`);
    return cachedGames;
  }

  const season = getCurrentNBASeason();
  const { start } = getSeasonDateRange(season);
  const today = new Date().toISOString().split('T')[0];

  const allGames: Game[] = [];
  let cursor: number | undefined = undefined;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 15; // Max iterations
  let consecutiveErrors = 0;
  const maxRetries = 3;

  console.log(`Fetching season ${season} games from ${start} to ${today}...`);

  while (hasMore && pageCount < maxPages && consecutiveErrors < maxRetries) {
    try {
      const response = await balldontlie.getGames({
        startDate: start,
        endDate: today,
        perPage: 100,
        cursor,
      });

      allGames.push(...response.data);
      // Use cursor-based pagination
      cursor = response.meta?.next_cursor ?? undefined;
      hasMore = cursor != null;
      consecutiveErrors = 0; // Reset on success
      pageCount++;

      console.log(`Page ${pageCount}: fetched ${response.data.length} games (total: ${allGames.length}, next_cursor: ${cursor})`);

      // Rate limit protection - use longer delay
      if (hasMore && pageCount < maxPages) {
        await delay(1000); // 1 second between requests
      }
    } catch (error: any) {
      consecutiveErrors++;
      const isRateLimit = error?.message?.includes('429');

      if (isRateLimit && consecutiveErrors < maxRetries) {
        // Exponential backoff for rate limits
        const backoffTime = Math.pow(2, consecutiveErrors) * 2000; // 4s, 8s, 16s
        console.log(`Rate limited on page ${pageCount + 1}, waiting ${backoffTime/1000}s before retry...`);
        await delay(backoffTime);
        // Don't increment page, retry with same cursor
      } else {
        console.error(`Error fetching games page ${pageCount + 1}:`, error?.message || error);
        if (consecutiveErrors >= maxRetries) {
          console.log('Max retries reached, using partial data');
        }
        break;
      }
    }
  }

  console.log(`Fetched ${allGames.length} total games for season ${season}`);

  // Cache the results
  cachedGames = allGames;
  cacheTimestamp = Date.now();

  return allGames;
}

// Calculate team stats from pre-fetched games
function calculateStatsFromGames(teamId: number, allGames: Game[]) {
  // Filter games for this team
  const teamGames = allGames.filter(
    (g) => g.home_team.id === teamId || g.visitor_team.id === teamId
  );

  // Filter to completed games only
  const completedGames = teamGames.filter((g) => g.status === 'Final');

  // Return default stats if no games
  if (completedGames.length === 0) {
    return { ...DEFAULT_STATS };
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

  // Sort by date descending for recent games calculation
  const sortedGames = [...completedGames].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate last 10 games
  const last10Games = sortedGames.slice(0, 10);
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
    opponentPointsPerGame: gamesPlayed > 0 ? totalOpponentPoints / gamesPlayed : 0,
    netRating:
      gamesPlayed > 0
        ? (totalPoints - totalOpponentPoints) / gamesPlayed
        : 0,
    streak: streak > 0 ? `W${streak}` : streak < 0 ? `L${Math.abs(streak)}` : '--',
    last10: `${last10Wins}-${last10Losses}`,
    last10Wins,
    last10Losses,
    atsWins: 0, // ATS data requires odds tracking
    atsLosses: 0,
    gamesPlayed,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conference = searchParams.get('conference');

    // Get teams from API (nbaData already filters, but add defensive check)
    let teams = await nbaData.getTeams();

    // Defensive filter to ensure only current NBA teams
    teams = teams.filter((t) => isCurrentNBATeam(t.id));

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

    // Fetch all season games once (cached for 15 minutes)
    let allSeasonGames: Game[] = [];
    if (!hasDbStats) {
      allSeasonGames = await fetchAllSeasonGames();
    }

    // Combine team data with stats
    const teamsWithStats = teams.map((team) => {
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
            opponentPointsPerGame: dbStats.pointsAgainst,
            netRating: dbStats.pointsPerGame - dbStats.pointsAgainst,
            streak: dbStats.streak > 0 ? `W${dbStats.streak}` : dbStats.streak < 0 ? `L${Math.abs(dbStats.streak)}` : '--',
            last10: `${dbStats.last10Wins}-${dbStats.last10Losses}`,
            last10Wins: dbStats.last10Wins,
            last10Losses: dbStats.last10Losses,
            atsWins: dbStats.atsWins,
            atsLosses: dbStats.atsLosses,
          },
        };
      }

      // Otherwise, calculate from pre-fetched games (only if database is empty)
      if (!hasDbStats) {
        const calculatedStats = calculateStatsFromGames(team.id, allSeasonGames);
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
