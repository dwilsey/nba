import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { dataFetcher } from '@/lib/data/fetcher';
import { createBallDontLieLiveScoresSource } from '@/lib/data/sources/balldontlie';
import { createESPNLiveScoresSource } from '@/lib/data/sources/espn';

/**
 * Verify completed games and calculate spread/total results
 * Updates predictions with actual scores, closing line comparison, and ATS results
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Verify Games] Starting verification...');

    // Get unverified predictions (games that might be finished)
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

    console.log(`[Verify Games] Found ${unverifiedPredictions.length} unverified predictions`);

    // Get unique dates to fetch scores for
    const dates = [...new Set(
      unverifiedPredictions.map(p => p.gameDate.toISOString().split('T')[0])
    )];

    // Fetch scores for each date
    const allScores: Map<string, { homeScore: number; awayScore: number; status: string }> = new Map();

    for (const date of dates) {
      try {
        const sources = [
          createBallDontLieLiveScoresSource(),
          createESPNLiveScoresSource(date),
        ];

        const result = await dataFetcher.fetchWithRetry(sources, `Scores for ${date}`);

        for (const game of result.data.games) {
          // Create a key based on teams
          const key = `${game.homeTeam}-${game.awayTeam}`;
          if (game.homeScore !== null && game.awayScore !== null) {
            allScores.set(key, {
              homeScore: game.homeScore,
              awayScore: game.awayScore,
              status: game.status,
            });
          }
        }
      } catch (error) {
        console.error(`[Verify Games] Failed to fetch scores for ${date}:`, error);
      }
    }

    let verified = 0;
    let spreadResults = 0;
    let errors = 0;

    for (const prediction of unverifiedPredictions) {
      try {
        const game = prediction.game;

        // Try to find score data
        const scoreKey = `${game.homeTeam}-${game.awayTeam}`;
        const scoreData = allScores.get(scoreKey);

        // Also check if game already has scores
        const homeScore = scoreData?.homeScore ?? game.homeScore;
        const awayScore = scoreData?.awayScore ?? game.awayScore;

        if (homeScore === null || awayScore === null) {
          continue; // Game not finished yet
        }

        // Get closing odds for this game
        const closingOdds = await prisma.oddsHistory.findFirst({
          where: {
            gameId: game.id,
            isClosing: true,
          },
          orderBy: { capturedAt: 'desc' },
        });

        // Calculate winner
        const actualWinner = homeScore > awayScore ? prediction.homeTeam : prediction.awayTeam;
        const isCorrect = prediction.predictedWinner === actualWinner;

        // Calculate spread result
        let spreadResult: string | null = null;
        const closingSpread = closingOdds?.spread ?? prediction.closingSpread;

        if (closingSpread !== null && closingSpread !== undefined) {
          const actualMargin = homeScore - awayScore;
          // Spread is from home team perspective (negative = home favored)
          // If spread is -5 and home wins by 6, home covered
          // If spread is -5 and home wins by 4, away covered

          if (actualMargin > closingSpread) {
            spreadResult = 'HOME_COVER';
          } else if (actualMargin < closingSpread) {
            spreadResult = 'AWAY_COVER';
          } else {
            spreadResult = 'PUSH';
          }
        }

        // Calculate total result
        let totalResult: string | null = null;
        const closingTotal = closingOdds?.total ?? prediction.closingTotal;

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

        // Determine if our spread prediction was correct
        // Compare our predicted spread vs the actual margin
        let ourSpreadCorrect: string | null = null;
        if (prediction.spreadPrediction !== null) {
          const actualMargin = homeScore - awayScore;
          const predictedMargin = prediction.spreadPrediction;

          // Did we predict the right direction?
          if ((predictedMargin < 0 && actualMargin < 0) || (predictedMargin > 0 && actualMargin > 0)) {
            // We got the direction right - now check accuracy
            const predictedDiff = Math.abs(actualMargin - predictedMargin);
            const vegasDiff = closingSpread !== null ? Math.abs(actualMargin - closingSpread) : null;

            if (vegasDiff !== null && predictedDiff < vegasDiff) {
              ourSpreadCorrect = 'WIN'; // Our spread was closer to actual
            } else if (vegasDiff !== null && predictedDiff > vegasDiff) {
              ourSpreadCorrect = 'LOSS'; // Vegas was closer
            } else {
              ourSpreadCorrect = 'PUSH';
            }
          } else if (predictedMargin < 0 && actualMargin > 0 || predictedMargin > 0 && actualMargin < 0) {
            ourSpreadCorrect = 'LOSS'; // Wrong direction entirely
          }
        }

        // Update prediction
        await prisma.prediction.update({
          where: { id: prediction.id },
          data: {
            actualWinner,
            isCorrect,
            actualHomeScore: homeScore,
            actualAwayScore: awayScore,
            closingSpread: closingSpread ?? prediction.closingSpread,
            closingTotal: closingTotal ?? prediction.closingTotal,
            spreadResult: spreadResult ?? ourSpreadCorrect,
            totalResult,
          },
        });

        // Update game record
        await prisma.game.update({
          where: { id: game.id },
          data: {
            status: 'FINAL',
            homeScore,
            awayScore,
          },
        });

        verified++;
        if (spreadResult) spreadResults++;

        console.log(
          `[Verify Games] ${game.awayTeam} @ ${game.homeTeam}: ` +
          `${awayScore}-${homeScore}, Correct: ${isCorrect}, Spread: ${spreadResult}`
        );
      } catch (error) {
        console.error(`[Verify Games] Error verifying prediction ${prediction.id}:`, error);
        errors++;
      }

      // Rate limit protection
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      message: `Verified ${verified} predictions`,
      verified,
      spreadResultsCalculated: spreadResults,
      errors,
      remaining: unverifiedPredictions.length - verified - errors,
    });
  } catch (error) {
    console.error('[Verify Games] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify games' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check verification status and overall results
 */
export async function GET() {
  try {
    // Overall stats
    const [
      totalPredictions,
      verifiedPredictions,
      correctPredictions,
      incorrectPredictions,
      pendingPredictions,
    ] = await Promise.all([
      prisma.prediction.count(),
      prisma.prediction.count({ where: { isCorrect: { not: null } } }),
      prisma.prediction.count({ where: { isCorrect: true } }),
      prisma.prediction.count({ where: { isCorrect: false } }),
      prisma.prediction.count({ where: { isCorrect: null } }),
    ]);

    // Spread/ATS stats
    const [
      homeCover,
      awayCover,
      spreadPush,
      overResults,
      underResults,
      totalPush,
    ] = await Promise.all([
      prisma.prediction.count({ where: { spreadResult: 'HOME_COVER' } }),
      prisma.prediction.count({ where: { spreadResult: 'AWAY_COVER' } }),
      prisma.prediction.count({ where: { spreadResult: 'PUSH' } }),
      prisma.prediction.count({ where: { totalResult: 'OVER' } }),
      prisma.prediction.count({ where: { totalResult: 'UNDER' } }),
      prisma.prediction.count({ where: { totalResult: 'PUSH' } }),
    ]);

    // Our spread accuracy (WIN means we were closer than Vegas)
    const [
      spreadWins,
      spreadLosses,
    ] = await Promise.all([
      prisma.prediction.count({ where: { spreadResult: 'WIN' } }),
      prisma.prediction.count({ where: { spreadResult: 'LOSS' } }),
    ]);

    const accuracy = verifiedPredictions > 0
      ? (correctPredictions / verifiedPredictions * 100).toFixed(1)
      : '0.0';

    const atsTotal = homeCover + awayCover + spreadPush;
    const ouTotal = overResults + underResults + totalPush;

    return NextResponse.json({
      overall: {
        total: totalPredictions,
        verified: verifiedPredictions,
        pending: pendingPredictions,
        correct: correctPredictions,
        incorrect: incorrectPredictions,
        accuracy: `${accuracy}%`,
      },
      ats: {
        homeCover,
        awayCover,
        push: spreadPush,
        total: atsTotal,
        record: `${homeCover + awayCover}-${spreadPush}`,
      },
      overUnder: {
        over: overResults,
        under: underResults,
        push: totalPush,
        total: ouTotal,
        record: `${overResults}-${underResults}-${totalPush}`,
      },
      ourSpreadAccuracy: {
        wins: spreadWins,
        losses: spreadLosses,
        total: spreadWins + spreadLosses,
        percentage: spreadWins + spreadLosses > 0
          ? `${(spreadWins / (spreadWins + spreadLosses) * 100).toFixed(1)}%`
          : 'N/A',
      },
    });
  } catch (error) {
    console.error('[Verify Games] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
