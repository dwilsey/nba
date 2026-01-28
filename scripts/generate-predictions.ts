import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get all games
  const games = await prisma.game.findMany();
  console.log("Found", games.length, "games");

  // Get all team stats
  const stats = await prisma.teamAdvancedStats.findMany({
    orderBy: { date: "desc" },
    distinct: ["teamId"],
  });
  const statsMap = new Map(stats.map((s) => [s.teamId, s]));
  console.log("Loaded stats for", stats.length, "teams");

  for (const game of games) {
    const homeStats = statsMap.get(String(game.homeTeamId));
    const awayStats = statsMap.get(String(game.awayTeamId));

    if (!homeStats || !awayStats) {
      console.log("Missing stats for", game.homeTeam, "or", game.awayTeam);
      continue;
    }

    const response = await fetch("http://localhost:8000/predict/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_id: game.id,
        home_team: {
          team_id: String(game.homeTeamId),
          team_name: game.homeTeam,
          off_rating: homeStats.offRating,
          def_rating: homeStats.defRating,
          net_rating: homeStats.netRating,
          pace: homeStats.pace,
          efg_pct: homeStats.efgPct,
          tov_pct: homeStats.tovPct,
          oreb_pct: homeStats.orebPct,
          ftr: homeStats.ftr,
          opp_efg_pct: homeStats.oppEfgPct,
          opp_tov_pct: homeStats.oppTovPct,
          opp_oreb_pct: homeStats.oppOrebPct,
          opp_ftr: homeStats.oppFtr,
        },
        away_team: {
          team_id: String(game.awayTeamId),
          team_name: game.awayTeam,
          off_rating: awayStats.offRating,
          def_rating: awayStats.defRating,
          net_rating: awayStats.netRating,
          pace: awayStats.pace,
          efg_pct: awayStats.efgPct,
          tov_pct: awayStats.tovPct,
          oreb_pct: awayStats.orebPct,
          ftr: awayStats.ftr,
          opp_efg_pct: awayStats.oppEfgPct,
          opp_tov_pct: awayStats.oppTovPct,
          opp_oreb_pct: awayStats.oppOrebPct,
          opp_ftr: awayStats.oppFtr,
        },
      }),
    });

    const pred = await response.json();

    // Store XGBoost prediction
    await prisma.xGBoostPrediction.upsert({
      where: { gameId: game.id },
      update: {
        homeWinProbability: pred.home_win_probability,
        awayWinProbability: pred.away_win_probability,
        predictedWinner: pred.predicted_winner,
        predictedSpread: pred.predicted_spread,
        predictedTotal: pred.predicted_total,
        predictedHomeScore: pred.predicted_home_score,
        predictedAwayScore: pred.predicted_away_score,
        confidence: pred.confidence,
        featureVector: pred.feature_vector,
        modelVersion: pred.model_version,
        generatedAt: new Date(pred.generated_at),
      },
      create: {
        gameId: game.id,
        homeWinProbability: pred.home_win_probability,
        awayWinProbability: pred.away_win_probability,
        predictedWinner: pred.predicted_winner,
        predictedSpread: pred.predicted_spread,
        predictedTotal: pred.predicted_total,
        predictedHomeScore: pred.predicted_home_score,
        predictedAwayScore: pred.predicted_away_score,
        confidence: pred.confidence,
        featureVector: pred.feature_vector,
        modelVersion: pred.model_version,
        generatedAt: new Date(pred.generated_at),
      },
    });

    // Store Prediction for backward compatibility
    await prisma.prediction.upsert({
      where: { gameId: game.id },
      update: {
        predictedWinner: pred.predicted_winner,
        confidence: pred.confidence,
        homeWinProbability: pred.home_win_probability,
        awayWinProbability: pred.away_win_probability,
        spreadPrediction: pred.predicted_spread,
        totalPrediction: pred.predicted_total,
        predictedHomeScore: pred.predicted_home_score,
        predictedAwayScore: pred.predicted_away_score,
        factors: { model: "xgboost", ...pred.feature_vector },
      },
      create: {
        gameId: game.id,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        predictedWinner: pred.predicted_winner,
        confidence: pred.confidence,
        homeWinProbability: pred.home_win_probability,
        awayWinProbability: pred.away_win_probability,
        spreadPrediction: pred.predicted_spread,
        totalPrediction: pred.predicted_total,
        predictedHomeScore: pred.predicted_home_score,
        predictedAwayScore: pred.predicted_away_score,
        gameDate: game.gameDate,
        factors: { model: "xgboost", ...pred.feature_vector },
      },
    });

    console.log(
      `${game.homeTeam} vs ${game.awayTeam}: ${pred.predicted_winner} (${(pred.home_win_probability * 100).toFixed(1)}% home, spread ${pred.predicted_spread})`
    );
  }

  console.log("\nDone! Generated predictions for all games.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
