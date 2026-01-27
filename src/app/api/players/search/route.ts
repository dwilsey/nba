import { NextRequest, NextResponse } from 'next/server';
import { balldontlie } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const teamId = searchParams.get('team');

    if (!query || query.length < 2) {
      return NextResponse.json({
        data: [],
        meta: { count: 0 },
      });
    }

    const response = await balldontlie.getPlayers({
      search: query,
      perPage: 15,
      teamIds: teamId ? [parseInt(teamId, 10)] : undefined,
    });

    return NextResponse.json({
      data: response.data.map((player) => ({
        id: player.id,
        name: `${player.first_name} ${player.last_name}`,
        position: player.position,
        team: {
          id: player.team.id,
          abbreviation: player.team.abbreviation,
          full_name: player.team.full_name,
        },
      })),
      meta: {
        count: response.data.length,
      },
    });
  } catch (error) {
    console.error('Error searching players:', error);
    return NextResponse.json(
      { error: 'Failed to search players' },
      { status: 500 }
    );
  }
}
