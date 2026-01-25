import { NextResponse } from 'next/server';
import { nbaData } from '@/lib/api';
import prisma from '@/lib/db/prisma';

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
