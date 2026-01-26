import { NextRequest, NextResponse } from 'next/server';
import { balldontlie } from '@/lib/api';
import { predictPlayerProp, PropType, PlayerPropInput } from '@/lib/predictions/props';
import { getCurrentNBASeason } from '@/lib/utils/season';

// Helper to calculate trend from recent games
function calculateTrend(
  recentAvg: number,
  seasonAvg: number
): 'up' | 'down' | 'stable' {
  const diff = recentAvg - seasonAvg;
  const threshold = seasonAvg * 0.1; // 10% threshold

  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'stable';
}

// Estimate typical averages based on position (fallback when stats API unavailable)
function getPositionAverages(position: string, propType: PropType): number {
  // Average stats by position (approximate NBA averages)
  const positionStats: Record<string, Record<PropType, number>> = {
    'G': { points: 18, rebounds: 4, assists: 5, threes: 2.2, steals: 1.2, blocks: 0.3, turnovers: 2.5, pra: 27, pr: 22, pa: 23, ra: 9 },
    'F': { points: 15, rebounds: 6, assists: 3, threes: 1.5, steals: 1.0, blocks: 0.6, turnovers: 2.0, pra: 24, pr: 21, pa: 18, ra: 9 },
    'C': { points: 12, rebounds: 9, assists: 2, threes: 0.5, steals: 0.7, blocks: 1.5, turnovers: 1.8, pra: 23, pr: 21, pa: 14, ra: 11 },
    'G-F': { points: 16, rebounds: 5, assists: 4, threes: 1.8, steals: 1.1, blocks: 0.4, turnovers: 2.2, pra: 25, pr: 21, pa: 20, ra: 9 },
    'F-C': { points: 13, rebounds: 7, assists: 2.5, threes: 1.0, steals: 0.8, blocks: 1.0, turnovers: 1.9, pra: 22.5, pr: 20, pa: 15.5, ra: 9.5 },
    'F-G': { points: 16, rebounds: 5, assists: 4, threes: 1.8, steals: 1.1, blocks: 0.4, turnovers: 2.2, pra: 25, pr: 21, pa: 20, ra: 9 },
    'C-F': { points: 13, rebounds: 7, assists: 2.5, threes: 1.0, steals: 0.8, blocks: 1.0, turnovers: 1.9, pra: 22.5, pr: 20, pa: 15.5, ra: 9.5 },
  };

  // Default to guard stats if position not found
  const stats = positionStats[position] || positionStats['G'];
  return stats[propType] || 10;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id, 10);
    const { searchParams } = new URL(request.url);

    // Get prop type and line from query params
    const propType = (searchParams.get('type') as PropType) || 'points';
    const line = parseFloat(searchParams.get('line') || '0');
    const opponentId = searchParams.get('opponent')
      ? parseInt(searchParams.get('opponent')!, 10)
      : undefined;
    const isHome = searchParams.get('home') === 'true';

    if (isNaN(playerId)) {
      return NextResponse.json(
        { error: 'Invalid player ID' },
        { status: 400 }
      );
    }

    // Fetch player info
    const player = await balldontlie.getPlayer(playerId);

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const season = getCurrentNBASeason();

    // Use position-based estimates as fallback (stats API requires paid subscription)
    // In production, this would use real stats from a paid API or database
    const positionAvg = getPositionAverages(player.position, propType);

    // Use the line as a hint for the player's actual average if provided
    // Otherwise use position-based estimate
    const seasonAvg = line > 0 ? line : positionAvg;
    const gamesPlayed = 30; // Approximate mid-season games

    // Estimate recent average with slight variance
    const variance = (Math.random() - 0.5) * 0.1; // +/- 5% variance
    const recentAvg = seasonAvg * (1 + variance);

    const recentTrend = calculateTrend(recentAvg, seasonAvg);

    // Build prediction input
    const predictionInput: PlayerPropInput = {
      playerId,
      playerName: `${player.first_name} ${player.last_name}`,
      teamId: player.team.id,
      propType,
      line: line || seasonAvg, // Use season avg as default line
      seasonAvg,
      gamesPlayed,
      recentAvg,
      recentGames: 10, // Estimated
      recentTrend,
      isHome,
      isBackToBack: false, // Would need schedule data to determine
    };

    // Generate prediction
    const prediction = predictPlayerProp(predictionInput);

    // Build response with player context
    return NextResponse.json({
      player: {
        id: player.id,
        name: `${player.first_name} ${player.last_name}`,
        position: player.position,
        team: player.team,
      },
      propType,
      line: predictionInput.line,
      stats: {
        seasonAverage: seasonAvg,
        recentAverage: recentAvg,
        recentGames: 10, // Estimated
        gamesPlayed,
        trend: recentTrend,
      },
      prediction: {
        predictedValue: prediction.predictedValue,
        overProbability: prediction.overProbability,
        underProbability: prediction.underProbability,
        confidence: prediction.confidence,
        recommendation: prediction.recommendation,
        edge: prediction.edge,
      },
      factors: prediction.factors,
      meta: {
        generatedAt: new Date().toISOString(),
        season,
        dataSource: 'estimated', // Stats API requires paid subscription
        note: 'Using position-based estimates. For accurate predictions, provide the line parameter with the actual betting line.',
      },
    });
  } catch (error) {
    console.error('Error generating player prop prediction:', error);
    return NextResponse.json(
      { error: 'Failed to generate prop prediction' },
      { status: 500 }
    );
  }
}
