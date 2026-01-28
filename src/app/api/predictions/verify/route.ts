import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { balldontlie } from '@/lib/api';

/**
 * Verify predictions for completed games
 * Updates actualWinner, isCorrect, and spread/total results
 */
export async function POST() {
  try {
    // Get all predictions that haven't been verified yet
    const unverifiedPredictions = await prisma.prediction.findMany({
      where: {
        OR: [
          { isCorrect: null },
          { spreadResult: null },
        ],
      },
      include: {
        game: true,
      },
    });

    if (unverifiedPredictions.length === 0) {
      return NextResponse.json({
        message: 'No unverified predictions found',
        verified: 0,
      });
    }

    let verified = 0;
    let spreadResultsCalculated = 0;
    let errors = 0;

    for (const prediction of unverifiedPredictions) {
      try {
        // Check if game has finished
        const gameId = parseInt(prediction.game.externalId, 10);
        const game = await balldontlie.getGame(gameId);

        if (game.status === 'Final') {
          const homeScore = game.home_team_score;
          const awayScore = game.visitor_team_score;
          const actualWinner =
            homeScore > awayScore
              ? game.home_team.full_name
              : game.visitor_team.full_name;
          const isCorrect = prediction.predictedWinner === actualWinner;

          // Get closing odds for spread/total calculation
          const closingOdds = await prisma.oddsHistory.findFirst({
            where: {
              gameId: prediction.game.id,
              isClosing: true,
            },
            orderBy: { capturedAt: 'desc' },
          });

          const closingSpread = closingOdds?.spread ?? prediction.closingSpread;
          const closingTotal = closingOdds?.total ?? prediction.closingTotal;

          // Calculate spread result
          let spreadResult: string | null = null;
          if (closingSpread !== null && closingSpread !== undefined) {
            const actualMargin = homeScore - awayScore;
            // Spread is from home team perspective (negative = home favored)
            if (actualMargin > closingSpread) {
              spreadResult = 'HOME_COVER';
            } else if (actualMargin < closingSpread) {
              spreadResult = 'AWAY_COVER';
            } else {
              spreadResult = 'PUSH';
            }

            // Also check if our spread prediction was more accurate than Vegas
            if (prediction.spreadPrediction !== null) {
              const predictedDiff = Math.abs(actualMargin - prediction.spreadPrediction);
              const vegasDiff = Math.abs(actualMargin - closingSpread);

              if (predictedDiff < vegasDiff) {
                spreadResult = 'WIN'; // Our spread was closer to actual
              } else if (predictedDiff > vegasDiff) {
                spreadResult = 'LOSS'; // Vegas was closer
              }
            }

            spreadResultsCalculated++;
          }

          // Calculate total result
          let totalResult: string | null = null;
          if (closingTotal !== null && closingTotal !== undefined) {
            const actualTotal = homeScore + awayScore;
            if (actualTotal > closingTotal) {
              totalResult = 'OVER';
            } else if (actualTotal < closingTotal) {
              totalResult = 'UNDER';
            } else {
              totalResult = 'PUSH';
            }
          }

          // Update prediction with all results
          await prisma.prediction.update({
            where: { id: prediction.id },
            data: {
              actualWinner,
              isCorrect,
              actualHomeScore: homeScore,
              actualAwayScore: awayScore,
              closingSpread: closingSpread ?? undefined,
              closingTotal: closingTotal ?? undefined,
              spreadResult,
              totalResult,
            },
          });

          // Also update the game record
          await prisma.game.update({
            where: { id: prediction.game.id },
            data: {
              status: 'FINAL',
              homeScore,
              awayScore,
            },
          });

          verified++;
        }
      } catch (error) {
        console.error(`Error verifying prediction ${prediction.id}:`, error);
        errors++;
      }

      // Rate limit protection
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      message: `Verified ${verified} predictions`,
      verified,
      spreadResultsCalculated,
      errors,
      remaining: unverifiedPredictions.length - verified - errors,
    });
  } catch (error) {
    console.error('Error verifying predictions:', error);
    return NextResponse.json(
      { error: 'Failed to verify predictions' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check verification status
 */
export async function GET() {
  try {
    const [total, verified, pending] = await Promise.all([
      prisma.prediction.count(),
      prisma.prediction.count({ where: { isCorrect: { not: null } } }),
      prisma.prediction.count({ where: { isCorrect: null } }),
    ]);

    const correctCount = await prisma.prediction.count({
      where: { isCorrect: true },
    });

    return NextResponse.json({
      total,
      verified,
      pending,
      accuracy: verified > 0 ? correctCount / verified : 0,
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
