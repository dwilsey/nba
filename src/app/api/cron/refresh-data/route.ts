import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { dataFetcher } from '@/lib/data/fetcher';
import {
  createBallDontLieLiveScoresSource,
  type LiveScoreData,
} from '@/lib/data/sources/balldontlie';
import { createESPNLiveScoresSource } from '@/lib/data/sources/espn';
import { oddsApi } from '@/lib/api/odds';

/**
 * Refresh live data - runs every 5 minutes on game days
 * Updates: live scores, current odds, game statuses
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    console.log(`[Refresh Data] Starting refresh at ${now.toISOString()}`);

    // Check if there are games today
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const gamesToday = await prisma.game.count({
      where: {
        gameDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    if (gamesToday === 0) {
      return NextResponse.json({
        message: 'No games today, skipping refresh',
        gamesRefreshed: 0,
      });
    }

    // Fetch live scores with retry logic
    const scoresSources = [
      createBallDontLieLiveScoresSource(),
      createESPNLiveScoresSource(today),
    ];

    let liveScores: LiveScoreData | null = null;
    let scoresSource = 'none';

    try {
      const result = await dataFetcher.fetchWithRetry(scoresSources, 'Live Scores');
      liveScores = result.data;
      scoresSource = result.source;
      console.log(`[Refresh Data] Fetched scores from ${scoresSource}`);
    } catch (error) {
      console.error('[Refresh Data] Failed to fetch scores from all sources:', error);
    }

    // Fetch current odds
    let currentOdds = null;
    try {
      currentOdds = await oddsApi.getOdds({
        regions: 'us',
        markets: 'h2h,spreads,totals',
      });
      console.log(`[Refresh Data] Fetched odds for ${currentOdds.length} games`);
    } catch (error) {
      console.error('[Refresh Data] Failed to fetch odds:', error);
    }

    // Update games in database
    let gamesUpdated = 0;
    let oddsRecorded = 0;
    let errors = 0;

    if (liveScores?.games) {
      for (const gameData of liveScores.games) {
        try {
          // Find matching game in database
          const game = await prisma.game.findFirst({
            where: {
              OR: [
                { externalId: gameData.externalId },
                {
                  AND: [
                    { homeTeam: gameData.homeTeam },
                    { awayTeam: gameData.awayTeam },
                    {
                      gameDate: {
                        gte: todayStart,
                        lt: todayEnd,
                      },
                    },
                  ],
                },
              ],
            },
          });

          if (!game) continue;

          // Map status
          const statusMap: Record<string, 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL' | 'POSTPONED'> = {
            SCHEDULED: 'SCHEDULED',
            IN_PROGRESS: 'IN_PROGRESS',
            FINAL: 'FINAL',
            POSTPONED: 'POSTPONED',
          };

          const status = statusMap[gameData.status] || game.status;

          // Update game
          await prisma.game.update({
            where: { id: game.id },
            data: {
              status,
              homeScore: gameData.homeScore,
              awayScore: gameData.awayScore,
            },
          });

          gamesUpdated++;

          // Record current odds if available
          if (currentOdds) {
            const gameOdds = currentOdds.find(
              (o) =>
                (o.homeTeam.includes(game.homeTeam) || game.homeTeam.includes(o.homeTeam)) &&
                (o.awayTeam.includes(game.awayTeam) || game.awayTeam.includes(o.awayTeam))
            );

            if (gameOdds && gameOdds.bookmakers.length > 0) {
              // Store current odds (not closing)
              const bestOdds = oddsApi.getBestOdds(gameOdds);
              if (bestOdds) {
                await prisma.oddsHistory.create({
                  data: {
                    gameId: game.id,
                    isClosing: false,
                    homeMoneyline: bestOdds.homeMoneyline,
                    awayMoneyline: bestOdds.awayMoneyline,
                    spread: bestOdds.spread,
                    spreadOdds: bestOdds.spreadOdds,
                    total: bestOdds.total,
                    overOdds: bestOdds.overOdds,
                    underOdds: bestOdds.underOdds,
                    bookmaker: 'Best Available',
                  },
                });
                oddsRecorded++;
              }
            }
          }
        } catch (error) {
          console.error(`[Refresh Data] Error updating game:`, error);
          errors++;
        }
      }
    }

    // Clean up old non-closing odds (keep last 24 hours only)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { count: deletedOdds } = await prisma.oddsHistory.deleteMany({
      where: {
        isClosing: false,
        capturedAt: {
          lt: dayAgo,
        },
      },
    });

    return NextResponse.json({
      message: 'Data refresh complete',
      timestamp: now.toISOString(),
      scoresSource,
      gamesUpdated,
      oddsRecorded,
      errors,
      cleanedUpOdds: deletedOdds,
      remainingOddsRequests: oddsApi.getRemainingRequests(),
    });
  } catch (error) {
    console.error('[Refresh Data] Error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh data' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check refresh status
 */
export async function GET() {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get today's game stats
    const [totalGames, scheduled, inProgress, final] = await Promise.all([
      prisma.game.count({
        where: { gameDate: { gte: todayStart, lt: todayEnd } },
      }),
      prisma.game.count({
        where: { gameDate: { gte: todayStart, lt: todayEnd }, status: 'SCHEDULED' },
      }),
      prisma.game.count({
        where: { gameDate: { gte: todayStart, lt: todayEnd }, status: 'IN_PROGRESS' },
      }),
      prisma.game.count({
        where: { gameDate: { gte: todayStart, lt: todayEnd }, status: 'FINAL' },
      }),
    ]);

    // Get recent odds history count
    const recentOdds = await prisma.oddsHistory.count({
      where: {
        capturedAt: {
          gte: new Date(now.getTime() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    // Check if it's game hours (roughly 12pm - 11pm ET)
    const hour = now.getUTCHours() - 5; // Rough ET conversion
    const isGameHours = hour >= 12 && hour <= 23;

    return NextResponse.json({
      currentTime: now.toISOString(),
      isGameHours,
      shouldRefresh: isGameHours && (scheduled > 0 || inProgress > 0),
      todaysGames: {
        total: totalGames,
        scheduled,
        inProgress,
        final,
      },
      recentOddsCaptures: recentOdds,
      oddsApiRemaining: oddsApi.getRemainingRequests(),
    });
  } catch (error) {
    console.error('[Refresh Data] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
