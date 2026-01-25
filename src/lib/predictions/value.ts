/**
 * Value Bet Calculations
 *
 * Identifies when our prediction differs significantly from the betting market,
 * indicating potential +EV (positive expected value) opportunities.
 */

import { Odds } from '@/types';

export interface ValueBetResult {
  hasValue: boolean;
  expectedValue: number;
  edgePercent: number;
  recommendedBet: 'home' | 'away' | 'over' | 'under' | 'home_spread' | 'away_spread' | null;
  explanation: string;
}

export interface ValueAnalysis {
  moneyline: {
    home: ValueBetResult;
    away: ValueBetResult;
  };
  spread: {
    home: ValueBetResult;
    away: ValueBetResult;
  };
  total: {
    over: ValueBetResult;
    under: ValueBetResult;
  };
  bestBet: ValueBetResult | null;
}

// Minimum thresholds for flagging value
const MIN_EV_THRESHOLD = 0.03; // 3% EV minimum
const MIN_EDGE_THRESHOLD = 0.05; // 5% edge vs implied probability

/**
 * Convert American odds to implied probability
 */
export function americanToImpliedProb(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  }
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return americanOdds / 100 + 1;
  }
  return 100 / Math.abs(americanOdds) + 1;
}

/**
 * Calculate expected value for a bet
 * EV = (Prob of Win × Potential Profit) - (Prob of Loss × Stake)
 *
 * @param predictedProb - Our predicted probability of winning (0-1)
 * @param americanOdds - The betting odds in American format
 * @returns Expected value as a decimal (0.05 = 5% EV)
 */
export function calculateExpectedValue(predictedProb: number, americanOdds: number): number {
  const decimalOdds = americanToDecimal(americanOdds);

  // EV = (Win Prob × Profit) - (Loss Prob × Stake)
  // With $1 stake: EV = (p × (decimal - 1)) - ((1-p) × 1)
  const ev = (predictedProb * (decimalOdds - 1)) - ((1 - predictedProb) * 1);

  return ev;
}

/**
 * Calculate edge over the market
 * Edge = Our Probability - Implied Probability
 */
export function calculateEdge(predictedProb: number, americanOdds: number): number {
  const impliedProb = americanToImpliedProb(americanOdds);
  return predictedProb - impliedProb;
}

/**
 * Analyze a single bet for value
 */
export function analyzeValueBet(
  predictedProb: number,
  americanOdds: number,
  betType: string
): ValueBetResult {
  const ev = calculateExpectedValue(predictedProb, americanOdds);
  const edge = calculateEdge(predictedProb, americanOdds);

  const hasValue = ev >= MIN_EV_THRESHOLD && edge >= MIN_EDGE_THRESHOLD;

  let explanation = '';
  if (hasValue) {
    explanation = `+${(ev * 100).toFixed(1)}% EV with ${(edge * 100).toFixed(1)}% edge over market`;
  } else if (ev > 0) {
    explanation = `Slight edge (+${(ev * 100).toFixed(1)}% EV) but below threshold`;
  } else {
    explanation = `No value (${(ev * 100).toFixed(1)}% EV)`;
  }

  return {
    hasValue,
    expectedValue: ev,
    edgePercent: edge,
    recommendedBet: hasValue ? betType as ValueBetResult['recommendedBet'] : null,
    explanation,
  };
}

/**
 * Full value analysis for a game
 */
export function analyzeGameValue(
  homeWinProb: number,
  awayWinProb: number,
  homeSpreadProb: number, // Probability home covers spread
  overProb: number,
  odds: Odds
): ValueAnalysis {
  const homeML = analyzeValueBet(homeWinProb, odds.homeMoneyline, 'home');
  const awayML = analyzeValueBet(awayWinProb, odds.awayMoneyline, 'away');

  const homeSpread = analyzeValueBet(homeSpreadProb, odds.spreadOdds, 'home_spread');
  const awaySpread = analyzeValueBet(1 - homeSpreadProb, odds.spreadOdds, 'away_spread');

  const over = analyzeValueBet(overProb, odds.overOdds, 'over');
  const under = analyzeValueBet(1 - overProb, odds.underOdds, 'under');

  // Find the best bet (highest EV with value)
  const allBets = [homeML, awayML, homeSpread, awaySpread, over, under];
  const valueBets = allBets.filter(b => b.hasValue);
  const bestBet = valueBets.length > 0
    ? valueBets.reduce((best, current) =>
        current.expectedValue > best.expectedValue ? current : best
      )
    : null;

  return {
    moneyline: { home: homeML, away: awayML },
    spread: { home: homeSpread, away: awaySpread },
    total: { over, under },
    bestBet,
  };
}

/**
 * Calculate Kelly Criterion bet size
 * Kelly % = (bp - q) / b
 * Where:
 *   b = decimal odds - 1 (the profit multiplier)
 *   p = probability of winning
 *   q = probability of losing (1 - p)
 *
 * @param predictedProb - Our predicted win probability
 * @param americanOdds - The betting odds
 * @returns Recommended bet size as fraction of bankroll (e.g., 0.05 = 5%)
 */
export function calculateKellyBetSize(predictedProb: number, americanOdds: number): number {
  const decimalOdds = americanToDecimal(americanOdds);
  const b = decimalOdds - 1;
  const p = predictedProb;
  const q = 1 - p;

  const kelly = (b * p - q) / b;

  // Return 0 if negative (no edge), cap at 25% (quarter Kelly is common)
  return Math.max(0, Math.min(kelly, 0.25));
}

/**
 * Format value bet for display
 */
export function formatValueBet(result: ValueBetResult): string {
  if (!result.hasValue) {
    return 'No value';
  }

  const evStr = (result.expectedValue * 100).toFixed(1);
  const edgeStr = (result.edgePercent * 100).toFixed(1);

  return `+${evStr}% EV (${edgeStr}% edge)`;
}

/**
 * Get value tier for UI display
 */
export function getValueTier(ev: number): 'none' | 'slight' | 'good' | 'strong' {
  if (ev < 0.02) return 'none';
  if (ev < 0.05) return 'slight';
  if (ev < 0.10) return 'good';
  return 'strong';
}
