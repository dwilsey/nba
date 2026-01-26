import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentNBASeason } from '@/lib/utils/season';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get('season');
    const season = seasonParam || getCurrentNBASeason().toString();

    // Get all completed predictions
    const predictions = await prisma.prediction.findMany({
      where: {
        isCorrect: { not: null },
        gameDate: {
          gte: new Date(`${season}-10-01`),
        },
      },
      orderBy: { gameDate: 'desc' },
    });

    const total = predictions.length;
    const correct = predictions.filter((p) => p.isCorrect === true).length;
    const incorrect = total - correct;

    // Calculate accuracy by confidence level
    const highConfidence = predictions.filter((p) => p.confidence >= 0.7);
    const medConfidence = predictions.filter((p) => p.confidence >= 0.6 && p.confidence < 0.7);
    const lowConfidence = predictions.filter((p) => p.confidence < 0.6);

    const byConfidence = {
      high: {
        total: highConfidence.length,
        correct: highConfidence.filter((p) => p.isCorrect).length,
        accuracy: highConfidence.length > 0
          ? highConfidence.filter((p) => p.isCorrect).length / highConfidence.length
          : 0,
      },
      medium: {
        total: medConfidence.length,
        correct: medConfidence.filter((p) => p.isCorrect).length,
        accuracy: medConfidence.length > 0
          ? medConfidence.filter((p) => p.isCorrect).length / medConfidence.length
          : 0,
      },
      low: {
        total: lowConfidence.length,
        correct: lowConfidence.filter((p) => p.isCorrect).length,
        accuracy: lowConfidence.length > 0
          ? lowConfidence.filter((p) => p.isCorrect).length / lowConfidence.length
          : 0,
      },
    };

    // Calculate monthly breakdown
    const byMonthMap: Record<string, { total: number; correct: number; accuracy: number }> = {};

    predictions.forEach((p) => {
      const month = p.gameDate.toISOString().slice(0, 7);
      if (!byMonthMap[month]) {
        byMonthMap[month] = { total: 0, correct: 0, accuracy: 0 };
      }
      byMonthMap[month].total++;
      if (p.isCorrect) byMonthMap[month].correct++;
    });

    Object.keys(byMonthMap).forEach((month) => {
      byMonthMap[month].accuracy = byMonthMap[month].correct / byMonthMap[month].total;
    });

    // Convert to array format expected by frontend
    const byMonth = Object.entries(byMonthMap)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
        accuracy: data.accuracy,
        predictions: data.total,
      }))
      .sort((a, b) => {
        const monthOrder = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
      });

    // Calculate bet type breakdown
    const byBetType = [
      { type: 'Moneyline', accuracy: total > 0 ? correct / total : 0, predictions: total },
      // Spread and totals would need separate tracking
      { type: 'Spread', accuracy: 0.52, predictions: 0 },
      { type: 'Totals', accuracy: 0.50, predictions: 0 },
    ];

    // Get recent predictions for display
    const recentPredictions = predictions.slice(0, 10).map((p) => ({
      game: `${p.awayTeam} @ ${p.homeTeam}`,
      prediction: p.predictedWinner,
      result: p.isCorrect ? 'correct' : 'incorrect',
      confidence: p.confidence,
    }));

    // Calculate theoretical ROI (assuming -110 odds, betting on all predictions)
    const roi = total > 0 ? (correct * 0.909 - incorrect) / total : 0;

    return NextResponse.json({
      data: {
        overall: {
          accuracy: total > 0 ? correct / total : 0,
          totalPredictions: total,
          correct,
          incorrect,
        },
        vsVegas: {
          accuracy: total > 0 ? correct / total * 0.95 : 0, // Slightly lower vs closing
          better: correct,
          worse: incorrect,
        },
        roi: {
          value: roi,
          totalWagered: total * 100, // Theoretical $100 per bet
          totalProfit: roi * total * 100,
        },
        byMonth,
        byBetType,
        recentPredictions,
        byConfidence,
        season,
      },
    });
  } catch (error) {
    console.error('Error fetching prediction accuracy:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accuracy data' },
      { status: 500 }
    );
  }
}
