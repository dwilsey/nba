import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bets = await prisma.bet.findMany({
      where: {
        userId: session.user.id,
        result: { not: 'PENDING' },
      },
      orderBy: { gameDate: 'asc' },
    });

    // Calculate overall stats
    const totalBets = bets.length;
    const wins = bets.filter((b) => b.result === 'WIN').length;
    const losses = bets.filter((b) => b.result === 'LOSS').length;
    const pushes = bets.filter((b) => b.result === 'PUSH').length;

    const totalWagered = bets.reduce((sum, b) => sum + b.amount, 0);
    const totalProfit = bets.reduce((sum, b) => sum + (b.profit || 0), 0);
    const winRate = totalBets > 0 ? wins / (wins + losses) : 0;
    const roi = totalWagered > 0 ? totalProfit / totalWagered : 0;

    // Calculate by bet type
    const byOddsType = ['MONEYLINE', 'SPREAD', 'TOTAL', 'PARLAY'].map((type) => {
      const typeBets = bets.filter((b) => b.oddsType === type);
      const typeWins = typeBets.filter((b) => b.result === 'WIN').length;
      const typeLosses = typeBets.filter((b) => b.result === 'LOSS').length;
      const typeProfit = typeBets.reduce((sum, b) => sum + (b.profit || 0), 0);
      const typeWagered = typeBets.reduce((sum, b) => sum + b.amount, 0);

      return {
        type,
        bets: typeBets.length,
        wins: typeWins,
        losses: typeLosses,
        profit: typeProfit,
        winRate: typeWins + typeLosses > 0 ? typeWins / (typeWins + typeLosses) : 0,
        roi: typeWagered > 0 ? typeProfit / typeWagered : 0,
      };
    }).filter((t) => t.bets > 0);

    // Calculate cumulative profit over time
    let cumulative = 0;
    const profitTimeline = bets.map((bet) => {
      cumulative += bet.profit || 0;
      return {
        date: bet.gameDate.toISOString().split('T')[0],
        profit: bet.profit || 0,
        cumulative,
      };
    });

    // Group by month
    const byMonth: Record<string, { bets: number; profit: number; wagered: number }> = {};
    bets.forEach((bet) => {
      const month = bet.gameDate.toISOString().slice(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = { bets: 0, profit: 0, wagered: 0 };
      }
      byMonth[month].bets++;
      byMonth[month].profit += bet.profit || 0;
      byMonth[month].wagered += bet.amount;
    });

    return NextResponse.json({
      data: {
        overview: {
          totalBets,
          wins,
          losses,
          pushes,
          totalWagered,
          totalProfit,
          winRate,
          roi,
        },
        byOddsType,
        byMonth,
        profitTimeline,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
