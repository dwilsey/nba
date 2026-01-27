import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { balldontlie } from '@/lib/api';
import { generatePrediction, PredictionInput } from '@/lib/predictions/model';
import { ELO_CONFIG } from '@/lib/predictions/elo';
import { getCurrentNBASeason, getSeasonDateRange } from '@/lib/utils/season';

/**
 * Seed historical predictions for the current season
 * This creates predictions for completed games and marks them as verified
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const season = getCurrentNBASeason();
    const { start } = getSeasonDateRange(season);
    const today = new Date().toISOString().split('T')[0];

    console.log(`Seeding predictions for season ${season} from ${start} to ${today}...`);

    // Fetch completed games from this season
    let allGames: any[] = [];
    let cursor: number | undefined = undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 10;

    while (hasMore && pageCount < maxPages && allGames.length < limit) {
      const response = await balldontlie.getGames({
        startDate: start,
        endDate: today,
        perPage: 100,
        cursor,
      });

      const completedGames = response.data.filter((g) => g.status === 'Final');
      allGames.push(...completedGames);

      cursor = response.meta?.next_cursor ?? undefined;
      hasMore = cursor != null;
      pageCount++;

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Limit to requested amount
    allGames = allGames.slice(0, limit);

    console.log(`Found ${allGames.length} completed games to seed`);

    let seeded = 0;
    let skipped = 0;
    let errors = 0;

    // Track ELO ratings for teams (simulated progression)
    const teamElos: Map<number, number> = new Map();

    for (const game of allGames) {
      try {
        const gameId = game.id.toString();

        // Check if already exists
        const existingGame = await prisma.game.findUnique({
          where: { externalId: gameId },
          include: { prediction: true },
        });

        if (existingGame?.prediction) {
          skipped++;
          continue;
        }

        // Get or initialize team ELOs
        let homeElo = teamElos.get(game.home_team.id) || ELO_CONFIG.INITIAL_ELO;
        let awayElo = teamElos.get(game.visitor_team.id) || ELO_CONFIG.INITIAL_ELO;

        // Generate prediction
        const predictionInput: PredictionInput = {
          gameId,
          homeTeam: game.home_team.full_name,
          awayTeam: game.visitor_team.full_name,
          homeTeamId: game.home_team.id,
          awayTeamId: game.visitor_team.id,
          homeElo,
          awayElo,
          gameDate: new Date(game.date),
          isPlayoff: game.postseason || false,
        };

        const prediction = generatePrediction(predictionInput);

        // Determine actual result
        const homeScore = game.home_team_score;
        const awayScore = game.visitor_team_score;
        const actualWinner =
          homeScore > awayScore
            ? game.home_team.full_name
            : game.visitor_team.full_name;
        const isCorrect = prediction.predictedWinner === actualWinner;

        // Create or update game record
        const dbGame = await prisma.game.upsert({
          where: { externalId: gameId },
          update: {
            status: 'FINAL',
            homeScore,
            awayScore,
          },
          create: {
            externalId: gameId,
            homeTeam: game.home_team.full_name,
            homeTeamId: game.home_team.id,
            awayTeam: game.visitor_team.full_name,
            awayTeamId: game.visitor_team.id,
            homeScore,
            awayScore,
            status: 'FINAL',
            gameDate: new Date(game.date),
            season: game.season,
          },
        });

        // Create prediction record (already verified)
        await prisma.prediction.create({
          data: {
            gameId: dbGame.id,
            homeTeam: prediction.homeTeam,
            awayTeam: prediction.awayTeam,
            predictedWinner: prediction.predictedWinner,
            confidence: prediction.confidence,
            homeWinProbability: prediction.homeWinProbability,
            awayWinProbability: prediction.awayWinProbability,
            spreadPrediction: prediction.predictedSpread,
            totalPrediction: prediction.predictedTotal,
            gameDate: new Date(game.date),
            factors: prediction.factors as any,
            actualWinner,
            isCorrect,
          },
        });

        // Update ELO ratings based on result
        const homeWon = homeScore > awayScore;
        const pointDiff = Math.abs(homeScore - awayScore);
        const kFactor = ELO_CONFIG.K_FACTOR_REGULAR;

        if (homeWon) {
          homeElo += kFactor * (1 - prediction.homeWinProbability);
          awayElo -= kFactor * prediction.homeWinProbability;
        } else {
          homeElo -= kFactor * prediction.homeWinProbability;
          awayElo += kFactor * (1 - prediction.homeWinProbability);
        }

        teamElos.set(game.home_team.id, homeElo);
        teamElos.set(game.visitor_team.id, awayElo);

        seeded++;
      } catch (error) {
        console.error(`Error seeding game ${game.id}:`, error);
        errors++;
      }

      // Small delay to avoid overwhelming the database
      if (seeded % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Calculate final accuracy
    const stats = await prisma.prediction.aggregate({
      _count: { isCorrect: true },
      where: { isCorrect: true },
    });

    const totalVerified = await prisma.prediction.count({
      where: { isCorrect: { not: null } },
    });

    return NextResponse.json({
      message: `Seeded ${seeded} predictions`,
      seeded,
      skipped,
      errors,
      total: seeded + skipped,
      accuracy: totalVerified > 0 ? stats._count.isCorrect / totalVerified : 0,
    });
  } catch (error) {
    console.error('Error seeding predictions:', error);
    return NextResponse.json(
      { error: 'Failed to seed predictions' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check current prediction stats
 */
export async function GET() {
  try {
    const [total, verified, correct] = await Promise.all([
      prisma.prediction.count(),
      prisma.prediction.count({ where: { isCorrect: { not: null } } }),
      prisma.prediction.count({ where: { isCorrect: true } }),
    ]);

    return NextResponse.json({
      total,
      verified,
      correct,
      accuracy: verified > 0 ? correct / verified : 0,
    });
  } catch (error) {
    console.error('Error fetching prediction stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
