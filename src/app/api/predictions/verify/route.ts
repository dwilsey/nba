import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { balldontlie } from '@/lib/api';

/**
 * Verify predictions for completed games
 * Updates actualWinner and isCorrect fields for games that have finished
 */
export async function POST() {
  try {
    // Get all predictions that haven't been verified yet
    const unverifiedPredictions = await prisma.prediction.findMany({
      where: {
        isCorrect: null,
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

          // Update prediction with result
          await prisma.prediction.update({
            where: { id: prediction.id },
            data: {
              actualWinner,
              isCorrect,
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
