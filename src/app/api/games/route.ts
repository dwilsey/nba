import { NextRequest, NextResponse } from 'next/server';
import { nbaData } from '@/lib/api';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const teamId = searchParams.get('teamId');

    let games;

    if (date) {
      // Get games for specific date
      games = await nbaData.getGames(date, date);
    } else if (startDate && endDate) {
      // Get games for date range
      games = await nbaData.getGames(startDate, endDate);
    } else {
      // Default to today's games
      games = await nbaData.getTodaysGames();
    }

    // Filter by team if specified
    if (teamId) {
      const id = parseInt(teamId, 10);
      games = games.filter(
        (g) => g.home_team.id === id || g.visitor_team.id === id
      );
    }

    // Get predictions for these games from database
    const gameIds = games.map((g) => g.id.toString());
    const predictions = await prisma.prediction.findMany({
      where: {
        gameId: { in: gameIds },
      },
    });

    const predictionsMap = new Map(
      predictions.map((p) => [p.gameId, p])
    );

    // Combine games with predictions
    const gamesWithPredictions = games.map((game) => ({
      ...game,
      prediction: predictionsMap.get(game.id.toString()) || null,
    }));

    return NextResponse.json({
      data: gamesWithPredictions,
      meta: {
        count: games.length,
        date: date || 'today',
      },
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}
