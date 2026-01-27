import { NextRequest, NextResponse } from 'next/server';
import { nbaData, balldontlie } from '@/lib/api';
import prisma from '@/lib/db/prisma';
import { generatePrediction, PredictionInput } from '@/lib/predictions/model';
import { ELO_CONFIG } from '@/lib/predictions/elo';
import { estimateEloFromStats } from '@/lib/predictions/elo-init';
import { getCurrentNBASeason, getSeasonDateRange } from '@/lib/utils/season';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);

    if (isNaN(gameId)) {
      return NextResponse.json(
        { error: 'Invalid game ID' },
        { status: 400 }
      );
    }

    // First check if we have this game in our database
    const dbGame = await prisma.game.findFirst({
      where: { externalId: gameId.toString() },
      include: { prediction: true },
    });

    // Try to fetch fresh data from the external API
    let game: any = null;
    try {
      game = await balldontlie.getGame(gameId);
    } catch (apiError) {
      // If external API fails but we have the game in DB, use that
      if (dbGame) {
        console.log(`External API failed for game ${gameId}, using database record`);
        game = {
          id: parseInt(dbGame.externalId),
          date: dbGame.gameDate.toISOString(),
          home_team: {
            id: dbGame.homeTeamId,
            full_name: dbGame.homeTeam,
            name: dbGame.homeTeam.split(' ').pop(),
            abbreviation: dbGame.homeTeam.substring(0, 3).toUpperCase(),
          },
          visitor_team: {
            id: dbGame.awayTeamId,
            full_name: dbGame.awayTeam,
            name: dbGame.awayTeam.split(' ').pop(),
            abbreviation: dbGame.awayTeam.substring(0, 3).toUpperCase(),
          },
          home_team_score: dbGame.homeScore || 0,
          visitor_team_score: dbGame.awayScore || 0,
          status: dbGame.status === 'FINAL' ? 'Final' : dbGame.status,
          season: dbGame.season,
          postseason: false,
        };
      } else {
        throw apiError;
      }
    }

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Check for existing prediction in database
    let prediction = dbGame?.prediction || await prisma.prediction.findFirst({
      where: { gameId: gameId.toString() },
    });

    // If no prediction, generate one
    if (!prediction) {
      // Get ELO ratings
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

      // Estimate ELO from stats if not in database
      if (homeElo === null || awayElo === null) {
        const season = getCurrentNBASeason();
        const { start } = getSeasonDateRange(season);
        const today = new Date().toISOString().split('T')[0];

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

      homeElo = homeElo ?? ELO_CONFIG.INITIAL_ELO;
      awayElo = awayElo ?? ELO_CONFIG.INITIAL_ELO;

      const predictionInput: PredictionInput = {
        gameId: gameId.toString(),
        homeTeam: game.home_team.full_name,
        awayTeam: game.visitor_team.full_name,
        homeTeamId: game.home_team.id,
        awayTeamId: game.visitor_team.id,
        homeElo,
        awayElo,
        gameDate: new Date(game.date),
        isPlayoff: game.postseason || false,
      };

      const generatedPrediction = generatePrediction(predictionInput);

      prediction = {
        id: `gen-${gameId}`,
        gameId: gameId.toString(),
        homeTeam: generatedPrediction.homeTeam,
        awayTeam: generatedPrediction.awayTeam,
        predictedWinner: generatedPrediction.predictedWinner,
        confidence: generatedPrediction.confidence,
        homeWinProbability: generatedPrediction.homeWinProbability,
        awayWinProbability: generatedPrediction.awayWinProbability,
        spreadPrediction: generatedPrediction.predictedSpread,
        totalPrediction: generatedPrediction.predictedTotal,
        gameDate: new Date(game.date),
        createdAt: new Date(),
        updatedAt: new Date(),
        actualWinner: null,
        isCorrect: null,
        factors: generatedPrediction.factors as any,
      };
    }

    // Get odds
    const odds = await nbaData.getOdds();
    const gameOdds = odds.find(
      (o) =>
        o.homeTeam.includes(game.home_team.name) ||
        o.awayTeam.includes(game.visitor_team.name)
    );

    return NextResponse.json({
      data: {
        ...game,
        prediction,
        odds: gameOdds ? nbaData.getBestOdds(gameOdds) : null,
        allOdds: gameOdds || null,
      },
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}
