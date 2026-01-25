import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = searchParams.get('season') || '2024';

    // Get all completed predictions
    const predictions = await prisma.prediction.findMany({
      where: {
        isCorrect: { not: null },
        gameDate: {
          gte: new Date(`${season}-10-01`),
        },
      },
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
    const byMonth: Record<string, { total: number; correct: number; accuracy: number }> = {};

    predictions.forEach((p) => {
      const month = p.gameDate.toISOString().slice(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = { total: 0, correct: 0, accuracy: 0 };
      }
      byMonth[month].total++;
      if (p.isCorrect) byMonth[month].correct++;
    });

    Object.keys(byMonth).forEach((month) => {
      byMonth[month].accuracy = byMonth[month].correct / byMonth[month].total;
    });

    return NextResponse.json({
      data: {
        overall: {
          total,
          correct,
          incorrect,
          accuracy: total > 0 ? correct / total : 0,
        },
        byConfidence,
        byMonth,
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
