import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { nbaData } from '@/lib/api';
import { generatePrediction, PredictionInput } from '@/lib/predictions/model';

// Default ELO rating for teams without history
const DEFAULT_ELO = 1500;

// Get team ELO from database or return default
async function getTeamElo(teamId: string): Promise<number> {
  try {
    const latestElo = await prisma.eloHistory.findFirst({
      where: { teamId },
      orderBy: { date: 'desc' },
    });
    return latestElo?.elo || DEFAULT_ELO;
  } catch {
    return DEFAULT_ELO;
  }
}

// Get team by external ID
async function getTeamByExternalId(externalId: number) {
  return prisma.team.findUnique({
    where: { externalId },
  });
}

// Generate predictions for games that don't have them yet
async function generatePredictionsForGames(games: any[]) {
  const predictions = [];

  for (const game of games) {
    // Check if prediction already exists
    const existingPrediction = await prisma.prediction.findUnique({
      where: { gameId: game.id.toString() },
    });

    if (existingPrediction) {
      predictions.push(existingPrediction);
      continue;
    }

    // Get team info from database
    const homeTeam = await getTeamByExternalId(game.home_team.id);
    const awayTeam = await getTeamByExternalId(game.visitor_team.id);

    // Get ELO ratings
    const homeElo = homeTeam ? await getTeamElo(homeTeam.id) : DEFAULT_ELO;
    const awayElo = awayTeam ? await getTeamElo(awayTeam.id) : DEFAULT_ELO;

    // Prepare input for prediction model
    const input: PredictionInput = {
      gameId: game.id.toString(),
      homeTeam: game.home_team.full_name,
      awayTeam: game.visitor_team.full_name,
      homeTeamId: game.home_team.id,
      awayTeamId: game.visitor_team.id,
      homeElo,
      awayElo,
      gameDate: new Date(game.date),
      isPlayoff: game.postseason || false,
    };

    // Generate prediction
    const prediction = generatePrediction(input);

    // Store in database
    try {
      const storedPrediction = await prisma.prediction.create({
        data: {
          gameId: prediction.gameId,
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
          game: {
            connectOrCreate: {
              where: { externalId: game.id.toString() },
              create: {
                externalId: game.id.toString(),
                homeTeam: game.home_team.full_name,
                homeTeamId: game.home_team.id,
                awayTeam: game.visitor_team.full_name,
                awayTeamId: game.visitor_team.id,
                status: game.status === 'Final' ? 'FINAL' : 'SCHEDULED',
                gameDate: new Date(game.date),
                season: new Date(game.date).getFullYear(),
              },
            },
          },
        },
      });
      predictions.push(storedPrediction);
    } catch (error) {
      // If game already exists, just create the prediction
      console.error('Error storing prediction:', error);
      predictions.push({
        gameId: prediction.gameId,
        homeTeam: prediction.homeTeam,
        awayTeam: prediction.awayTeam,
        predictedWinner: prediction.predictedWinner,
        confidence: prediction.confidence,
        homeWinProbability: prediction.homeWinProbability,
        awayWinProbability: prediction.awayWinProbability,
        spreadPrediction: prediction.predictedSpread,
        gameDate: new Date(game.date),
      });
    }
  }

  return predictions;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const generate = searchParams.get('generate') !== 'false'; // Default to true

    const where: Record<string, unknown> = {};

    if (date) {
      const dateStart = new Date(date);
      const dateEnd = new Date(date);
      dateEnd.setDate(dateEnd.getDate() + 1);

      where.gameDate = {
        gte: dateStart,
        lt: dateEnd,
      };
    } else if (startDate && endDate) {
      where.gameDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // First, try to get existing predictions from database
    let predictions = await prisma.prediction.findMany({
      where,
      orderBy: { gameDate: 'desc' },
      take: limit,
    });

    // If no predictions found and a specific date is requested, try to generate them
    if (predictions.length === 0 && generate && date) {
      try {
        // Fetch games for the requested date
        const games = await nbaData.getGames(date, date);

        if (games.length > 0) {
          // Generate predictions for these games
          predictions = await generatePredictionsForGames(games);
        }
      } catch (error) {
        console.error('Error generating predictions:', error);
        // Return empty array if generation fails
      }
    }

    return NextResponse.json({
      data: predictions,
      meta: {
        count: predictions.length,
        generated: predictions.length > 0 && generate,
      },
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
