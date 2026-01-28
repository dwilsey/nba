import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { oddsApi } from '@/lib/api/odds';

/**
 * Capture closing odds at game tip-off time
 * Runs every minute during game hours (6pm-11pm ET)
 * Captures odds with isClosing: true at exact game start time
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
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Find games that are starting right now (within 5 minute window)
    const gamesStartingSoon = await prisma.game.findMany({
      where: {
        status: 'SCHEDULED',
        gameDate: {
          gte: fiveMinutesAgo,
          lte: fiveMinutesFromNow,
        },
      },
    });

    if (gamesStartingSoon.length === 0) {
      return NextResponse.json({
        message: 'No games starting in this window',
        captured: 0,
      });
    }

    console.log(`[Closing Odds] Found ${gamesStartingSoon.length} games starting soon`);

    // Fetch current odds from API
    const allOdds = await oddsApi.getOdds({
      regions: 'us',
      markets: 'h2h,spreads,totals',
    });

    let captured = 0;
    let errors = 0;

    for (const game of gamesStartingSoon) {
      try {
        // Find odds for this game (match by team names)
        const gameOdds = allOdds.find(
          (o) =>
            (o.homeTeam.includes(game.homeTeam) || game.homeTeam.includes(o.homeTeam)) &&
            (o.awayTeam.includes(game.awayTeam) || game.awayTeam.includes(o.awayTeam))
        );

        if (!gameOdds || gameOdds.bookmakers.length === 0) {
          console.log(`[Closing Odds] No odds found for ${game.awayTeam} @ ${game.homeTeam}`);
          continue;
        }

        // Check if we already captured closing odds for this game
        const existingClosing = await prisma.oddsHistory.findFirst({
          where: {
            gameId: game.id,
            isClosing: true,
          },
        });

        if (existingClosing) {
          console.log(`[Closing Odds] Already captured for ${game.awayTeam} @ ${game.homeTeam}`);
          continue;
        }

        // Get best available odds to store as closing
        const bestOdds = oddsApi.getBestOdds(gameOdds);

        if (!bestOdds) {
          console.log(`[Closing Odds] Could not determine best odds for ${game.awayTeam} @ ${game.homeTeam}`);
          continue;
        }

        // Store closing odds for each bookmaker
        for (const bookmaker of gameOdds.bookmakers) {
          await prisma.oddsHistory.create({
            data: {
              gameId: game.id,
              isClosing: true,
              homeMoneyline: bookmaker.homeMoneyline,
              awayMoneyline: bookmaker.awayMoneyline,
              spread: bookmaker.spread,
              spreadOdds: bookmaker.spreadOdds,
              total: bookmaker.total,
              overOdds: bookmaker.overOdds,
              underOdds: bookmaker.underOdds,
              bookmaker: bookmaker.bookmaker,
            },
          });
        }

        // Also update the prediction with closing spread/total
        await prisma.prediction.updateMany({
          where: { gameId: game.id },
          data: {
            closingSpread: bestOdds.spread,
            closingTotal: bestOdds.total,
          },
        });

        captured++;
        console.log(`[Closing Odds] Captured for ${game.awayTeam} @ ${game.homeTeam}`);
      } catch (error) {
        console.error(`[Closing Odds] Error capturing for game ${game.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      message: `Captured closing odds for ${captured} games`,
      captured,
      errors,
      gamesChecked: gamesStartingSoon.length,
    });
  } catch (error) {
    console.error('[Closing Odds] Error:', error);
    return NextResponse.json(
      { error: 'Failed to capture closing odds' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check closing odds status
 */
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalGamesToday, gamesWithClosing, recentCaptures] = await Promise.all([
      prisma.game.count({
        where: {
          gameDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      prisma.oddsHistory.groupBy({
        by: ['gameId'],
        where: {
          isClosing: true,
          capturedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      prisma.oddsHistory.findMany({
        where: {
          isClosing: true,
          capturedAt: {
            gte: today,
          },
        },
        orderBy: { capturedAt: 'desc' },
        take: 10,
        include: {
          game: {
            select: {
              homeTeam: true,
              awayTeam: true,
              gameDate: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      today: {
        totalGames: totalGamesToday,
        gamesWithClosingOdds: gamesWithClosing.length,
        pending: totalGamesToday - gamesWithClosing.length,
      },
      recentCaptures: recentCaptures.map((c) => ({
        game: `${c.game.awayTeam} @ ${c.game.homeTeam}`,
        capturedAt: c.capturedAt,
        spread: c.spread,
        total: c.total,
        bookmaker: c.bookmaker,
      })),
    });
  } catch (error) {
    console.error('[Closing Odds] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
