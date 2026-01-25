import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/db/prisma';
import { z } from 'zod';

const createInjurySchema = z.object({
  playerId: z.number(),
  playerName: z.string(),
  teamId: z.string(),
  status: z.enum(['out', 'questionable', 'probable']),
  impact: z.enum(['high', 'medium', 'low']),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const injuries = await prisma.injuryFlag.findMany({
      where: {
        clearedAt: null,
      },
      orderBy: [
        { impact: 'desc' },
        { flaggedAt: 'desc' },
      ],
    });

    return NextResponse.json({
      data: injuries,
      meta: {
        count: injuries.length,
      },
    });
  } catch (error) {
    console.error('Error fetching injuries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch injuries' },
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
    const result = createInjurySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    // Check if injury already exists for this player
    const existing = await prisma.injuryFlag.findFirst({
      where: {
        playerId: data.playerId,
        clearedAt: null,
      },
    });

    if (existing) {
      // Update existing
      const injury = await prisma.injuryFlag.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          impact: data.impact,
          notes: data.notes,
        },
      });
      return NextResponse.json({ data: injury });
    }

    // Create new
    const injury = await prisma.injuryFlag.create({
      data: {
        playerId: data.playerId,
        playerName: data.playerName,
        teamId: data.teamId,
        status: data.status,
        impact: data.impact,
        notes: data.notes,
        flaggedBy: 'manual',
      },
    });

    return NextResponse.json({ data: injury }, { status: 201 });
  } catch (error) {
    console.error('Error creating injury flag:', error);
    return NextResponse.json(
      { error: 'Failed to create injury flag' },
      { status: 500 }
    );
  }
}
