/**
 * XGBoost predictions API endpoint.
 *
 * Generates predictions using the Python XGBoost microservice.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  getXGBoostClient,
  buildTeamFeatures,
  createDefaultTeamFeatures,
  type PredictionRequest,
  type XGBoostPrediction,
} from "@/lib/predictions/xgboost-client";

interface GameWithStats {
  id: string;
  externalId: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  gameDate: Date;
  oddsHistory?: {
    spread: number;
    isClosing: boolean;
  }[];
}

/**
 * GET /api/predictions/xgboost
 *
 * Generate XGBoost predictions for games on a specific date.
 *
 * Query params:
 * - date: YYYY-MM-DD format (default: today)
 * - gameId: Optional specific game ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const gameId = searchParams.get("gameId");

    // Check if XGBoost service is available
    const client = getXGBoostClient();
    const isReady = await client.isReady();

    if (!isReady) {
      return NextResponse.json(
        {
          error: "XGBoost service unavailable",
          message:
            "The XGBoost prediction service is not running or model is not loaded",
        },
        { status: 503 }
      );
    }

    // Get games
    let games: GameWithStats[];

    if (gameId) {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          oddsHistory: {
            select: { spread: true, isClosing: true },
            orderBy: { capturedAt: "desc" },
          },
        },
      });

      if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
      }

      games = [game];
    } else {
      // Get games for date
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      games = await prisma.game.findMany({
        where: {
          gameDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: "SCHEDULED",
        },
        include: {
          oddsHistory: {
            select: { spread: true, isClosing: true },
            orderBy: { capturedAt: "desc" },
          },
        },
      });
    }

    if (games.length === 0) {
      return NextResponse.json({
        predictions: [],
        message: "No games found for the specified date",
      });
    }

    // Get advanced stats for all teams
    const teamIds = [
      ...new Set(
        games.flatMap((g) => [String(g.homeTeamId), String(g.awayTeamId)])
      ),
    ];

    const advancedStats = await prisma.teamAdvancedStats.findMany({
      where: {
        teamId: { in: teamIds },
      },
      orderBy: { date: "desc" },
      distinct: ["teamId"],
    });

    const statsMap = new Map(advancedStats.map((s) => [s.teamId, s]));

    // Get BPM data for teams
    const currentSeason = new Date().getFullYear();
    const bpmData = await prisma.playerBPM.findMany({
      where: {
        teamId: { in: teamIds },
        season: currentSeason,
      },
    });

    // Aggregate BPM by team
    const teamBpmMap = new Map<
      string,
      { teamBpm: number; top5Bpm: number }
    >();

    for (const teamId of teamIds) {
      const teamPlayers = bpmData
        .filter((p) => p.teamId === teamId)
        .sort((a, b) => b.bpm - a.bpm);

      if (teamPlayers.length > 0) {
        const totalMinutes = teamPlayers.reduce(
          (sum, p) => sum + p.minutesPlayed,
          0
        );
        const weightedBpm =
          teamPlayers.reduce((sum, p) => sum + p.bpm * p.minutesPlayed, 0) /
          (totalMinutes || 1);

        const top5Players = teamPlayers.slice(0, 5);
        const top5Bpm =
          top5Players.reduce((sum, p) => sum + p.bpm, 0) /
          (top5Players.length || 1);

        teamBpmMap.set(teamId, { teamBpm: weightedBpm, top5Bpm });
      }
    }

    // Build prediction requests
    const predictionRequests: PredictionRequest[] = games.map((game) => {
      const homeStats = statsMap.get(String(game.homeTeamId));
      const awayStats = statsMap.get(String(game.awayTeamId));
      const homeBpm = teamBpmMap.get(String(game.homeTeamId));
      const awayBpm = teamBpmMap.get(String(game.awayTeamId));

      // Get opening and current spread from odds history
      const openingOdds = game.oddsHistory?.find((o) => !o.isClosing);
      const currentOdds = game.oddsHistory?.find((o) => o.isClosing) || openingOdds;

      const homeFeatures = homeStats
        ? buildTeamFeatures(
            String(game.homeTeamId),
            game.homeTeam,
            {
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
            },
            homeBpm
          )
        : createDefaultTeamFeatures(String(game.homeTeamId), game.homeTeam);

      const awayFeatures = awayStats
        ? buildTeamFeatures(
            String(game.awayTeamId),
            game.awayTeam,
            {
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
            },
            awayBpm
          )
        : createDefaultTeamFeatures(String(game.awayTeamId), game.awayTeam);

      return {
        game_id: game.id,
        home_team: homeFeatures,
        away_team: awayFeatures,
        opening_spread: openingOdds?.spread,
        current_spread: currentOdds?.spread,
        home_sos_ortg: homeStats?.sosOrtg ?? undefined,
        home_sos_drtg: homeStats?.sosDrtg ?? undefined,
        away_sos_ortg: awayStats?.sosOrtg ?? undefined,
        away_sos_drtg: awayStats?.sosDrtg ?? undefined,
      };
    });

    // Get predictions from XGBoost service
    let predictions: XGBoostPrediction[];

    if (predictionRequests.length === 1) {
      predictions = [await client.predict(predictionRequests[0])];
    } else {
      predictions = await client.predictBatch(predictionRequests);
    }

    // Store predictions in database
    for (const pred of predictions) {
      await prisma.xGBoostPrediction.upsert({
        where: { gameId: pred.game_id },
        update: {
          homeWinProbability: pred.home_win_probability,
          awayWinProbability: pred.away_win_probability,
          predictedWinner: pred.predicted_winner,
          predictedSpread: pred.predicted_spread,
          predictedTotal: pred.predicted_total,
          confidence: pred.confidence,
          featureVector: pred.feature_vector,
          modelVersion: pred.model_version,
          generatedAt: new Date(pred.generated_at),
        },
        create: {
          gameId: pred.game_id,
          homeWinProbability: pred.home_win_probability,
          awayWinProbability: pred.away_win_probability,
          predictedWinner: pred.predicted_winner,
          predictedSpread: pred.predicted_spread,
          predictedTotal: pred.predicted_total,
          confidence: pred.confidence,
          featureVector: pred.feature_vector,
          modelVersion: pred.model_version,
          generatedAt: new Date(pred.generated_at),
        },
      });
    }

    return NextResponse.json({
      predictions,
      count: predictions.length,
      model_version: predictions[0]?.model_version || "unknown",
    });
  } catch (error) {
    console.error("XGBoost prediction error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate predictions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/predictions/xgboost
 *
 * Generate prediction for a specific game with custom features.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const client = getXGBoostClient();
    const isReady = await client.isReady();

    if (!isReady) {
      return NextResponse.json(
        {
          error: "XGBoost service unavailable",
          message:
            "The XGBoost prediction service is not running or model is not loaded",
        },
        { status: 503 }
      );
    }

    // Validate request
    if (!body.game_id || !body.home_team || !body.away_team) {
      return NextResponse.json(
        { error: "Missing required fields: game_id, home_team, away_team" },
        { status: 400 }
      );
    }

    const prediction = await client.predict(body as PredictionRequest);

    // Store in database if game exists
    const game = await prisma.game.findUnique({
      where: { id: body.game_id },
    });

    if (game) {
      await prisma.xGBoostPrediction.upsert({
        where: { gameId: prediction.game_id },
        update: {
          homeWinProbability: prediction.home_win_probability,
          awayWinProbability: prediction.away_win_probability,
          predictedWinner: prediction.predicted_winner,
          predictedSpread: prediction.predicted_spread,
          predictedTotal: prediction.predicted_total,
          confidence: prediction.confidence,
          featureVector: prediction.feature_vector,
          modelVersion: prediction.model_version,
          generatedAt: new Date(prediction.generated_at),
        },
        create: {
          gameId: prediction.game_id,
          homeWinProbability: prediction.home_win_probability,
          awayWinProbability: prediction.away_win_probability,
          predictedWinner: prediction.predicted_winner,
          predictedSpread: prediction.predicted_spread,
          predictedTotal: prediction.predicted_total,
          confidence: prediction.confidence,
          featureVector: prediction.feature_vector,
          modelVersion: prediction.model_version,
          generatedAt: new Date(prediction.generated_at),
        },
      });
    }

    return NextResponse.json(prediction);
  } catch (error) {
    console.error("XGBoost prediction error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate prediction",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
