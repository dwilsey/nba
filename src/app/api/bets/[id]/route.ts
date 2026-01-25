import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/db/prisma';
import { z } from 'zod';
import { calculateProfit } from '@/lib/utils/formatting';

const updateBetSchema = z.object({
  result: z.enum(['PENDING', 'WIN', 'LOSS', 'PUSH', 'VOID']).optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bet = await prisma.bet.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    return NextResponse.json({ data: bet });
  } catch (error) {
    console.error('Error fetching bet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bet' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = updateBetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingBet = await prisma.bet.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingBet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    // Calculate profit if result is being updated
    let profit: number | null = null;
    if (result.data.result) {
      if (result.data.result === 'WIN') {
        profit = calculateProfit(existingBet.amount, existingBet.odds, true);
      } else if (result.data.result === 'LOSS') {
        profit = -existingBet.amount;
      } else if (result.data.result === 'PUSH' || result.data.result === 'VOID') {
        profit = 0;
      }
    }

    const bet = await prisma.bet.update({
      where: { id: params.id },
      data: {
        ...result.data,
        profit: profit !== null ? profit : existingBet.profit,
      },
    });

    return NextResponse.json({ data: bet });
  } catch (error) {
    console.error('Error updating bet:', error);
    return NextResponse.json(
      { error: 'Failed to update bet' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const existingBet = await prisma.bet.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingBet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    await prisma.bet.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bet:', error);
    return NextResponse.json(
      { error: 'Failed to delete bet' },
      { status: 500 }
    );
  }
}
