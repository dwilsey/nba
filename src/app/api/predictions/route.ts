import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: Record<string, unknown> = {};

    if (date) {
      const dateStart = new Date(date);
      const dateEnd = new Date(date);
      dateEnd.setDate(dateEnd.getDate() + 1);

      where.gameDate = {
        gte: dateStart,
        lt: dateEnd,
      };
    } else if (startDate && endDate) {
      where.gameDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const predictions = await prisma.prediction.findMany({
      where,
      orderBy: { gameDate: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      data: predictions,
      meta: {
        count: predictions.length,
      },
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
