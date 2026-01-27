/**
 * Main Prediction Engine
 *
 * Combines ELO ratings with additional factors to generate
 * win probabilities, spread predictions, and confidence scores.
 */

import {
  calculateWinProbability,
  eloToSpread,
  getConfidenceLevel,
  ELO_CONFIG,
} from './elo';
import {
  PredictionFactors,
  FACTOR_WEIGHTS,
  calculateRecentFormFactor,
  calculateRestFactor,
  calculateHeadToHeadFactor,
  calculateTravelFactor,
  calculateInjuryFactor,
  factorToProbabilityAdjustment,
} from './factors';
import { analyzeGameValue, ValueAnalysis } from './value';
import { Odds } from '@/types';

export interface GamePrediction {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;

  // Core predictions
  homeWinProbability: number;
  awayWinProbability: number;
  predictedWinner: string;
  confidence: number;

  // Spread & total
  predictedSpread: number; // Negative = home favored
  predictedTotal: number | null;

  // Model inputs
  homeElo: number;
  awayElo: number;
  factors: PredictionFactors;

  // Value analysis (if odds provided)
  valueAnalysis: ValueAnalysis | null;

  // Metadata
  isPlayoff: boolean;
  generatedAt: string;
}

export interface PredictionInput {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeElo: number;
  awayElo: number;
  gameDate: Date;
  isPlayoff?: boolean;

  // Optional factors
  homeL10?: { wins: number; losses: number };
  awayL10?: { wins: number; losses: number };
  homeDaysRest?: number;
  awayDaysRest?: number;
  homeH2HWins?: number;
  awayH2HWins?: number;
  awayTravelMiles?: number;
  homeInjuryImpact?: number;
  awayInjuryImpact?: number;
  homeCourtAdvantage?: number;

  // Optional odds for value analysis
  odds?: Odds;
}

/**
 * Generate a complete prediction for a game
 */
export function generatePrediction(input: PredictionInput): GamePrediction {
  const isPlayoff = input.isPlayoff || false;

  // Use provided home court advantage or default
  const homeAdvantage = input.homeCourtAdvantage ?? ELO_CONFIG.HOME_ADVANTAGE_DEFAULT;

  // Calculate base probability from ELO
  const baseProb = calculateWinProbability(input.homeElo, input.awayElo, homeAdvantage);

  // Calculate all factors
  const factors = calculateAllFactors(input, homeAdvantage);

  // Combine factor adjustments
  const factorAdjustment = calculateTotalAdjustment(factors);

  // Apply adjustment to base probability
  let homeWinProb = baseProb.home + factorAdjustment;

  // Clamp to valid probability range
  homeWinProb = Math.max(0.05, Math.min(0.95, homeWinProb));
  const awayWinProb = 1 - homeWinProb;

  // Calculate predicted spread from adjusted probabilities
  // Negative spread = home favored (matching Vegas convention)
  // eloToSpread returns positive when home ELO is higher, so we negate it
  const baseSpread = -eloToSpread(input.homeElo - input.awayElo + homeAdvantage);
  const adjustedSpread = baseSpread - (factorAdjustment * 50); // Factor adjustment in points (negative = favors home)

  // Calculate confidence
  const eloDiff = Math.abs(input.homeElo - input.awayElo);
  let confidence = getConfidenceLevel(eloDiff);

  // Reduce confidence if factors are mixed (some favor home, some away)
  const factorAlignment = calculateFactorAlignment(factors);
  confidence *= factorAlignment;

  // Playoff games get slight confidence boost (less variance)
  if (isPlayoff) {
    confidence = Math.min(0.95, confidence * 1.05);
  }

  // Determine winner
  const predictedWinner = homeWinProb > 0.5 ? input.homeTeam : input.awayTeam;

  // Value analysis if odds provided
  let valueAnalysis: ValueAnalysis | null = null;
  if (input.odds) {
    // For spread probability, use a simplified model
    // Assume ~50% base with adjustment based on spread difference
    const actualSpread = input.odds.spread;
    const spreadDiff = adjustedSpread - actualSpread;
    const homeSpreadProb = 0.5 + (spreadDiff * 0.02); // 2% per point of line value

    // For totals, we'd need additional data - use 50/50 for now
    const overProb = 0.5;

    valueAnalysis = analyzeGameValue(
      homeWinProb,
      awayWinProb,
      Math.max(0.1, Math.min(0.9, homeSpreadProb)),
      overProb,
      input.odds
    );
  }

  return {
    gameId: input.gameId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    homeWinProbability: homeWinProb,
    awayWinProbability: awayWinProb,
    predictedWinner,
    confidence,
    predictedSpread: adjustedSpread,
    predictedTotal: null, // Would require pace/efficiency data
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    factors,
    valueAnalysis,
    isPlayoff,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate all prediction factors
 */
function calculateAllFactors(input: PredictionInput, homeAdvantage: number): PredictionFactors {
  // Recent form
  const homeL10 = input.homeL10 || { wins: 5, losses: 5 };
  const awayL10 = input.awayL10 || { wins: 5, losses: 5 };
  const recentFormValue = calculateRecentFormFactor(homeL10, awayL10);

  // Rest
  const homeDaysRest = input.homeDaysRest ?? 1;
  const awayDaysRest = input.awayDaysRest ?? 1;
  const restValue = calculateRestFactor(homeDaysRest, awayDaysRest);

  // Head to head
  const homeH2H = input.homeH2HWins ?? 0;
  const awayH2H = input.awayH2HWins ?? 0;
  const h2hValue = calculateHeadToHeadFactor(homeH2H, awayH2H);

  // Travel
  const travelMiles = input.awayTravelMiles ?? 0;
  const travelValue = calculateTravelFactor(travelMiles);

  // Injuries
  const homeInjury = input.homeInjuryImpact ?? 0;
  const awayInjury = input.awayInjuryImpact ?? 0;
  const injuryValue = calculateInjuryFactor(homeInjury, awayInjury);

  return {
    eloDifference: {
      value: input.homeElo - input.awayElo,
      homeElo: input.homeElo,
      awayElo: input.awayElo,
      weight: FACTOR_WEIGHTS.eloDifference,
      contribution: 0, // ELO handled separately
    },
    recentForm: {
      homeL10,
      awayL10,
      value: recentFormValue,
      weight: FACTOR_WEIGHTS.recentForm,
      contribution: factorToProbabilityAdjustment(recentFormValue, FACTOR_WEIGHTS.recentForm),
    },
    homeCourt: {
      advantage: homeAdvantage,
      isNeutral: homeAdvantage === 0,
      weight: FACTOR_WEIGHTS.homeCourt,
      contribution: 0, // Home court handled in ELO calculation
    },
    restAdvantage: {
      homeDaysRest,
      awayDaysRest,
      homeBackToBack: homeDaysRest === 0,
      awayBackToBack: awayDaysRest === 0,
      value: restValue,
      weight: FACTOR_WEIGHTS.restAdvantage,
      contribution: factorToProbabilityAdjustment(restValue, FACTOR_WEIGHTS.restAdvantage),
    },
    headToHead: {
      homeWins: homeH2H,
      awayWins: awayH2H,
      value: h2hValue,
      weight: FACTOR_WEIGHTS.headToHead,
      contribution: factorToProbabilityAdjustment(h2hValue, FACTOR_WEIGHTS.headToHead),
    },
    travel: {
      awayTravelMiles: travelMiles,
      value: travelValue,
      weight: FACTOR_WEIGHTS.travel,
      contribution: factorToProbabilityAdjustment(travelValue, FACTOR_WEIGHTS.travel),
    },
    injuries: {
      homeImpact: homeInjury,
      awayImpact: awayInjury,
      value: injuryValue,
      weight: FACTOR_WEIGHTS.injuries,
      contribution: factorToProbabilityAdjustment(injuryValue, FACTOR_WEIGHTS.injuries),
    },
  };
}

/**
 * Calculate total probability adjustment from factors
 */
function calculateTotalAdjustment(factors: PredictionFactors): number {
  return (
    factors.recentForm.contribution +
    factors.restAdvantage.contribution +
    factors.headToHead.contribution +
    factors.travel.contribution +
    factors.injuries.contribution
  );
}

/**
 * Calculate how aligned the factors are
 * Returns 1.0 if all factors point same direction, lower if mixed
 */
function calculateFactorAlignment(factors: PredictionFactors): number {
  const values = [
    factors.recentForm.value,
    factors.restAdvantage.value,
    factors.headToHead.value,
    factors.travel.value,
    factors.injuries.value,
  ];

  // Count how many favor home (positive) vs away (negative)
  const positiveCount = values.filter(v => v > 0.05).length;
  const negativeCount = values.filter(v => v < -0.05).length;
  const neutralCount = values.length - positiveCount - negativeCount;

  // Perfect alignment = 1.0, complete disagreement = 0.7
  const maxSided = Math.max(positiveCount, negativeCount);
  const alignment = 0.7 + (maxSided / values.length) * 0.3;

  return alignment;
}

/**
 * Format prediction for display
 */
export function formatPrediction(prediction: GamePrediction): string {
  const homeProb = (prediction.homeWinProbability * 100).toFixed(1);
  const awayProb = (prediction.awayWinProbability * 100).toFixed(1);
  const spread = prediction.predictedSpread > 0
    ? `+${prediction.predictedSpread.toFixed(1)}`
    : prediction.predictedSpread.toFixed(1);
  const confidence = (prediction.confidence * 100).toFixed(0);

  return `${prediction.homeTeam} ${homeProb}% vs ${prediction.awayTeam} ${awayProb}% (Spread: ${spread}, Confidence: ${confidence}%)`;
}
