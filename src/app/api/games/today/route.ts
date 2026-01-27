import { NextResponse } from 'next/server';
import { nbaData, balldontlie } from '@/lib/api';
import prisma from '@/lib/db/prisma';
import { generatePrediction, PredictionInput } from '@/lib/predictions/model';
import { ELO_CONFIG } from '@/lib/predictions/elo';
import { estimateEloFromStats } from '@/lib/predictions/elo-init';
import { calculateL10Record } from '@/lib/predictions/factors';
import { getCurrentNBASeason, getSeasonDateRange } from '@/lib/utils/season';

export async function GET() {
  try {
    const games = await nbaData.getTodaysGames();

    // Get predictions for today's games
    const gameIds = games.map((g) => g.id.toString());
    const predictions = await prisma.prediction.findMany({
      where: {
        gameId: { in: gameIds },
      },
    });

    const predictionsMap = new Map(
      predictions.map((p) => [p.gameId, p])
    );

    // Generate predictions on-demand for games without existing predictions
    for (const game of games) {
      const gameId = game.id.toString();
      if (!predictionsMap.has(gameId)) {
        try {
          // Get ELO ratings from history or use default
          const [homeEloRecord, awayEloRecord] = await Promise.all([
            prisma.eloHistory.findFirst({
              where: { teamId: game.home_team.id.toString() },
              orderBy: { date: 'desc' },
            }),
            prisma.eloHistory.findFirst({
              where: { teamId: game.visitor_team.id.toString() },
              orderBy: { date: 'desc' },
            }),
          ]);

          let homeElo = homeEloRecord?.elo ?? null;
          let awayElo = awayEloRecord?.elo ?? null;

          // If no ELO history, estimate from team stats
          if (homeElo === null || awayElo === null) {
            const season = getCurrentNBASeason();
            const { start } = getSeasonDateRange(season);
            const today = new Date().toISOString().split('T')[0];

            // Fetch team games for the season to calculate win%
            const [homeGamesResponse, awayGamesResponse] = await Promise.all([
              homeElo === null
                ? balldontlie.getGames({
                    teamIds: [game.home_team.id],
                    startDate: start,
                    endDate: today,
                    perPage: 100,
                  })
                : null,
              awayElo === null
                ? balldontlie.getGames({
                    teamIds: [game.visitor_team.id],
                    startDate: start,
                    endDate: today,
                    perPage: 100,
                  })
                : null,
            ]);

            // Calculate home team ELO from games
            if (homeGamesResponse && homeElo === null) {
              const homeGames = homeGamesResponse.data.filter((g) => g.status === 'Final');
              let homeWins = 0, homeLosses = 0, homePts = 0, homeOppPts = 0;
              homeGames.forEach((g) => {
                const isHome = g.home_team.id === game.home_team.id;
                const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
                const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
                homePts += teamScore;
                homeOppPts += oppScore;
                if (teamScore > oppScore) homeWins++;
                else homeLosses++;
              });
              homeElo = estimateEloFromStats({
                wins: homeWins,
                losses: homeLosses,
                pointsPerGame: homeGames.length > 0 ? homePts / homeGames.length : undefined,
                opponentPointsPerGame: homeGames.length > 0 ? homeOppPts / homeGames.length : undefined,
              });
            }

            // Calculate away team ELO from games
            if (awayGamesResponse && awayElo === null) {
              const awayGames = awayGamesResponse.data.filter((g) => g.status === 'Final');
              let awayWins = 0, awayLosses = 0, awayPts = 0, awayOppPts = 0;
              awayGames.forEach((g) => {
                const isHome = g.home_team.id === game.visitor_team.id;
                const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
                const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
                awayPts += teamScore;
                awayOppPts += oppScore;
                if (teamScore > oppScore) awayWins++;
                else awayLosses++;
              });
              awayElo = estimateEloFromStats({
                wins: awayWins,
                losses: awayLosses,
                pointsPerGame: awayGames.length > 0 ? awayPts / awayGames.length : undefined,
                opponentPointsPerGame: awayGames.length > 0 ? awayOppPts / awayGames.length : undefined,
              });
            }
          }

          // Fallback to default if still null
          homeElo = homeElo ?? ELO_CONFIG.INITIAL_ELO;
          awayElo = awayElo ?? ELO_CONFIG.INITIAL_ELO;

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
            console.error(`Failed to fetch L10 data for game ${gameId}:`, l10Error);
            // Continue with default L10 values
          }

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
            homeL10,
            awayL10,
          };

          const prediction = generatePrediction(predictionInput);

          // Store in database for tracking
          try {
            // First, ensure the Game record exists
            const dbGame = await prisma.game.upsert({
              where: { externalId: gameId },
              update: {
                status: game.status === 'Final' ? 'FINAL' : game.status === 'In Progress' ? 'IN_PROGRESS' : 'SCHEDULED',
                homeScore: game.home_team_score || null,
                awayScore: game.visitor_team_score || null,
              },
              create: {
                externalId: gameId,
                homeTeam: game.home_team.full_name,
                homeTeamId: game.home_team.id,
                awayTeam: game.visitor_team.full_name,
                awayTeamId: game.visitor_team.id,
                homeScore: game.home_team_score || null,
                awayScore: game.visitor_team_score || null,
                status: game.status === 'Final' ? 'FINAL' : game.status === 'In Progress' ? 'IN_PROGRESS' : 'SCHEDULED',
                gameDate: new Date(game.date),
                season: game.season,
              },
            });

            // Now save the prediction
            const savedPrediction = await prisma.prediction.upsert({
              where: { gameId: dbGame.id },
              update: {
                // Only update if game hasn't started yet
                ...(game.status !== 'Final' && game.status !== 'In Progress'
                  ? {
                      predictedWinner: prediction.predictedWinner,
                      confidence: prediction.confidence,
                      homeWinProbability: prediction.homeWinProbability,
                      awayWinProbability: prediction.awayWinProbability,
                      spreadPrediction: prediction.predictedSpread,
                      totalPrediction: prediction.predictedTotal,
                      factors: prediction.factors as any,
                    }
                  : {}),
              },
              create: {
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
              },
            });

            predictionsMap.set(gameId, savedPrediction);
          } catch (dbError) {
            console.error(`Failed to save prediction for game ${gameId}:`, dbError);
            // Still store in map for response
            predictionsMap.set(gameId, {
              id: `gen-${gameId}`,
              gameId,
              homeTeam: prediction.homeTeam,
              awayTeam: prediction.awayTeam,
              predictedWinner: prediction.predictedWinner,
              confidence: prediction.confidence,
              homeWinProbability: prediction.homeWinProbability,
              awayWinProbability: prediction.awayWinProbability,
              spreadPrediction: prediction.predictedSpread,
              totalPrediction: prediction.predictedTotal,
              gameDate: new Date(game.date),
              createdAt: new Date(),
              updatedAt: new Date(),
              actualWinner: null,
              isCorrect: null,
              factors: prediction.factors as any,
            });
          }
        } catch (error) {
          console.error(`Failed to generate prediction for game ${gameId}:`, error);
        }
      }
    }

    // Get odds for today's games
    const odds = await nbaData.getOdds();

    // Combine all data
    const gamesWithData = games.map((game) => {
      const gameOdds = odds.find(
        (o) =>
          o.homeTeam.includes(game.home_team.name) ||
          o.awayTeam.includes(game.visitor_team.name)
      );

      return {
        ...game,
        prediction: predictionsMap.get(game.id.toString()) || null,
        odds: gameOdds ? nbaData.getBestOdds(gameOdds) : null,
      };
    });

    return NextResponse.json({
      data: gamesWithData,
      meta: {
        count: games.length,
        date: new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('Error fetching today\'s games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}
