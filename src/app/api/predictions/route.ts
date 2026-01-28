import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { nbaData } from '@/lib/api';
import { generatePrediction, PredictionInput } from '@/lib/predictions/model';
import { calculateL10Record } from '@/lib/predictions/factors';
import {
  getXGBoostClient,
  buildTeamFeatures,
  createDefaultTeamFeatures,
  type PredictionRequest,
} from '@/lib/predictions/xgboost-client';

// Feature flag for XGBoost model
const USE_XGBOOST_MODEL = process.env.USE_XGBOOST_MODEL === 'true';

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

    // Fetch recent games for L10 calculation
    let homeL10 = { wins: 5, losses: 5 };
    let awayL10 = { wins: 5, losses: 5 };
    try {
      const [homeRecentGames, awayRecentGames] = await Promise.all([
        nbaData.getTeamRecentGames(game.home_team.id, 10),
        nbaData.getTeamRecentGames(game.visitor_team.id, 10),
      ]);

      if (homeRecentGames.length > 0) {
        homeL10 = calculateL10Record(homeRecentGames, game.home_team.id);
      }
      if (awayRecentGames.length > 0) {
        awayL10 = calculateL10Record(awayRecentGames, game.visitor_team.id);
      }
    } catch (l10Error) {
      console.error(`Failed to fetch L10 data for game ${game.id}:`, l10Error);
      // Continue with default L10 values
    }

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
      homeL10,
      awayL10,
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

// Generate predictions using XGBoost model
async function generateXGBoostPredictions(games: any[]) {
  const client = getXGBoostClient();
  const isReady = await client.isReady();

  if (!isReady) {
    console.warn('XGBoost service not available, falling back to ELO model');
    return null;
  }

  const predictions = [];

  // Get advanced stats for all teams
  const teamIds = [
    ...new Set(games.flatMap((g) => [String(g.home_team.id), String(g.visitor_team.id)])),
  ];

  const advancedStats = await prisma.teamAdvancedStats.findMany({
    where: { teamId: { in: teamIds } },
    orderBy: { date: 'desc' },
    distinct: ['teamId'],
  });

  const statsMap = new Map(advancedStats.map((s) => [s.teamId, s]));

  // Build prediction requests
  const requests: PredictionRequest[] = [];

  for (const game of games) {
    const homeStats = statsMap.get(String(game.home_team.id));
    const awayStats = statsMap.get(String(game.visitor_team.id));

    const homeFeatures = homeStats
      ? buildTeamFeatures(String(game.home_team.id), game.home_team.full_name, {
          offRating: homeStats.offRating,
          defRating: homeStats.defRating,
          netRating: homeStats.netRating,
          pace: homeStats.pace,
          efgPct: homeStats.efgPct,
          tovPct: homeStats.tovPct,
          orebPct: homeStats.orebPct,
          ftr: homeStats.ftr,
          oppEfgPct: homeStats.oppEfgPct,
          oppTovPct: homeStats.oppTovPct,
          oppOrebPct: homeStats.oppOrebPct,
          oppFtr: homeStats.oppFtr,
          adjOffRating: homeStats.adjOffRating ?? undefined,
          adjDefRating: homeStats.adjDefRating ?? undefined,
          adjNetRating: homeStats.adjNetRating ?? undefined,
        })
      : createDefaultTeamFeatures(String(game.home_team.id), game.home_team.full_name);

    const awayFeatures = awayStats
      ? buildTeamFeatures(String(game.visitor_team.id), game.visitor_team.full_name, {
          offRating: awayStats.offRating,
          defRating: awayStats.defRating,
          netRating: awayStats.netRating,
          pace: awayStats.pace,
          efgPct: awayStats.efgPct,
          tovPct: awayStats.tovPct,
          orebPct: awayStats.orebPct,
          ftr: awayStats.ftr,
          oppEfgPct: awayStats.oppEfgPct,
          oppTovPct: awayStats.oppTovPct,
          oppOrebPct: awayStats.oppOrebPct,
          oppFtr: awayStats.oppFtr,
          adjOffRating: awayStats.adjOffRating ?? undefined,
          adjDefRating: awayStats.adjDefRating ?? undefined,
          adjNetRating: awayStats.adjNetRating ?? undefined,
        })
      : createDefaultTeamFeatures(String(game.visitor_team.id), game.visitor_team.full_name);

    requests.push({
      game_id: game.id.toString(),
      home_team: homeFeatures,
      away_team: awayFeatures,
      home_sos_ortg: homeStats?.sosOrtg ?? undefined,
      home_sos_drtg: homeStats?.sosDrtg ?? undefined,
      away_sos_ortg: awayStats?.sosOrtg ?? undefined,
      away_sos_drtg: awayStats?.sosDrtg ?? undefined,
    });
  }

  try {
    const xgboostResults = await client.predictBatch(requests);

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const xgPred = xgboostResults[i];

      // Store XGBoost prediction
      await prisma.xGBoostPrediction.upsert({
        where: { gameId: xgPred.game_id },
        update: {
          homeWinProbability: xgPred.home_win_probability,
          awayWinProbability: xgPred.away_win_probability,
          predictedWinner: xgPred.predicted_winner,
          predictedSpread: xgPred.predicted_spread,
          predictedTotal: xgPred.predicted_total,
          confidence: xgPred.confidence,
          featureVector: xgPred.feature_vector,
          modelVersion: xgPred.model_version,
          generatedAt: new Date(xgPred.generated_at),
        },
        create: {
          gameId: xgPred.game_id,
          homeWinProbability: xgPred.home_win_probability,
          awayWinProbability: xgPred.away_win_probability,
          predictedWinner: xgPred.predicted_winner,
          predictedSpread: xgPred.predicted_spread,
          predictedTotal: xgPred.predicted_total,
          confidence: xgPred.confidence,
          featureVector: xgPred.feature_vector,
          modelVersion: xgPred.model_version,
          generatedAt: new Date(xgPred.generated_at),
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

      // Also create a Prediction record for backward compatibility
      const storedPrediction = await prisma.prediction.upsert({
        where: { gameId: xgPred.game_id },
        update: {
          predictedWinner: xgPred.predicted_winner,
          confidence: xgPred.confidence,
          homeWinProbability: xgPred.home_win_probability,
          awayWinProbability: xgPred.away_win_probability,
          spreadPrediction: xgPred.predicted_spread,
          totalPrediction: xgPred.predicted_total,
          factors: {
            model: 'xgboost',
            modelVersion: xgPred.model_version,
            featureVector: xgPred.feature_vector,
          },
        },
        create: {
          gameId: xgPred.game_id,
          homeTeam: game.home_team.full_name,
          awayTeam: game.visitor_team.full_name,
          predictedWinner: xgPred.predicted_winner,
          confidence: xgPred.confidence,
          homeWinProbability: xgPred.home_win_probability,
          awayWinProbability: xgPred.away_win_probability,
          spreadPrediction: xgPred.predicted_spread,
          totalPrediction: xgPred.predicted_total,
          gameDate: new Date(game.date),
          factors: {
            model: 'xgboost',
            modelVersion: xgPred.model_version,
            featureVector: xgPred.feature_vector,
          },
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
    }

    return predictions;
  } catch (error) {
    console.error('XGBoost prediction error:', error);
    return null;
  }
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
          // Try XGBoost model if enabled
          if (USE_XGBOOST_MODEL) {
            const xgboostPredictions = await generateXGBoostPredictions(games);
            if (xgboostPredictions) {
              predictions = xgboostPredictions;
            } else {
              // Fall back to ELO model
              predictions = await generatePredictionsForGames(games);
            }
          } else {
            // Use traditional ELO model
            predictions = await generatePredictionsForGames(games);
          }
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
        model: USE_XGBOOST_MODEL ? 'xgboost' : 'elo',
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
