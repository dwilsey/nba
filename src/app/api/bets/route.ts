import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/db/prisma';
import { z } from 'zod';

const createBetSchema = z.object({
  team: z.string().min(1),
  opponent: z.string().min(1),
  oddsType: z.enum(['MONEYLINE', 'SPREAD', 'TOTAL', 'PARLAY']),
  odds: z.number(),
  amount: z.number().positive(),
  gameDate: z.string(),
  gameId: z.string().optional(),
  sportsbook: z.string().optional(),
  notes: z.string().optional(),
  // Player prop fields
  playerName: z.string().optional(),
  propType: z.string().optional(),
  propLine: z.number().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = searchParams.get('result');
    const oddsType = searchParams.get('oddsType');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (result && result !== 'all') {
      where.result = result.toUpperCase();
    }

    if (oddsType && oddsType !== 'all') {
      where.oddsType = oddsType.toUpperCase();
    }

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.bet.count({ where }),
    ]);

    return NextResponse.json({
      data: bets,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + bets.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching bets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = createBetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    const bet = await prisma.bet.create({
      data: {
        userId: session.user.id,
        team: data.team,
        opponent: data.opponent,
        oddsType: data.oddsType,
        odds: data.odds,
        amount: data.amount,
        gameDate: new Date(data.gameDate),
        gameId: data.gameId,
        notes: data.notes,
        result: 'PENDING',
      },
    });

    return NextResponse.json({ data: bet }, { status: 201 });
  } catch (error) {
    console.error('Error creating bet:', error);
    return NextResponse.json(
      { error: 'Failed to create bet' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all bets for user
    await prisma.bet.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bets:', error);
    return NextResponse.json(
      { error: 'Failed to delete bets' },
      { status: 500 }
    );
  }
}
