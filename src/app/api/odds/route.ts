import { NextResponse } from 'next/server';
import { nbaData, oddsApi } from '@/lib/api';

export async function GET() {
  try {
    const odds = await nbaData.getOdds();

    // Transform to include best odds for each game
    const gamesWithBestOdds = odds.map((gameOdds) => ({
      gameId: gameOdds.gameId,
      homeTeam: gameOdds.homeTeam,
      awayTeam: gameOdds.awayTeam,
      commenceTime: gameOdds.commenceTime,
      bestOdds: nbaData.getBestOdds(gameOdds),
      allBookmakers: gameOdds.bookmakers,
    }));

    return NextResponse.json({
      data: gamesWithBestOdds,
      meta: {
        count: gamesWithBestOdds.length,
        remainingRequests: oddsApi.getRemainingRequests(),
      },
    });
  } catch (error) {
    console.error('Error fetching odds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch odds' },
      { status: 500 }
    );
  }
}
