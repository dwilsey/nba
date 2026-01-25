/**
 * Prediction Factor Calculations
 *
 * Each factor contributes to the final prediction with specific weights:
 * - ELO difference: 40%
 * - Recent form (L10): 20%
 * - Home court (dynamic): 15%
 * - Rest advantage: 10%
 * - Head-to-head: 5%
 * - Travel distance: 5%
 * - Injury impact: 5%
 */

import { Game } from '@/types';

export interface PredictionFactors {
  eloDifference: {
    value: number;
    homeElo: number;
    awayElo: number;
    weight: number;
    contribution: number;
  };
  recentForm: {
    homeL10: { wins: number; losses: number };
    awayL10: { wins: number; losses: number };
    value: number;
    weight: number;
    contribution: number;
  };
  homeCourt: {
    advantage: number;
    isNeutral: boolean;
    weight: number;
    contribution: number;
  };
  restAdvantage: {
    homeDaysRest: number;
    awayDaysRest: number;
    homeBackToBack: boolean;
    awayBackToBack: boolean;
    value: number;
    weight: number;
    contribution: number;
  };
  headToHead: {
    homeWins: number;
    awayWins: number;
    value: number;
    weight: number;
    contribution: number;
  };
  travel: {
    awayTravelMiles: number;
    value: number;
    weight: number;
    contribution: number;
  };
  injuries: {
    homeImpact: number;
    awayImpact: number;
    value: number;
    weight: number;
    contribution: number;
  };
}

export const FACTOR_WEIGHTS = {
  eloDifference: 0.40,
  recentForm: 0.20,
  homeCourt: 0.15,
  restAdvantage: 0.10,
  headToHead: 0.05,
  travel: 0.05,
  injuries: 0.05,
};

/**
 * Calculate recent form factor from last 10 games
 * Returns a value from -1 (away much better) to 1 (home much better)
 */
export function calculateRecentFormFactor(
  homeL10: { wins: number; losses: number },
  awayL10: { wins: number; losses: number }
): number {
  const homeWinPct = homeL10.wins / (homeL10.wins + homeL10.losses) || 0.5;
  const awayWinPct = awayL10.wins / (awayL10.wins + awayL10.losses) || 0.5;

  // Weight recent games more heavily (exponential decay would be better but this is simpler)
  return homeWinPct - awayWinPct;
}

/**
 * Calculate rest advantage factor
 * Back-to-backs are penalized, extra rest is rewarded
 */
export function calculateRestFactor(
  homeDaysRest: number,
  awayDaysRest: number
): number {
  // Normalize to -1 to 1 scale
  // 0 days rest (B2B) = -0.5 penalty
  // 1 day rest = baseline (0)
  // 2+ days rest = slight bonus (0.1 per extra day, max 0.3)

  const homeRestValue = homeDaysRest === 0 ? -0.5 : Math.min((homeDaysRest - 1) * 0.1, 0.3);
  const awayRestValue = awayDaysRest === 0 ? -0.5 : Math.min((awayDaysRest - 1) * 0.1, 0.3);

  return homeRestValue - awayRestValue;
}

/**
 * Calculate head-to-head factor from season matchups
 */
export function calculateHeadToHeadFactor(
  homeWins: number,
  awayWins: number
): number {
  const totalGames = homeWins + awayWins;
  if (totalGames === 0) return 0;

  // Return differential as fraction of games played
  return (homeWins - awayWins) / totalGames;
}

/**
 * Calculate travel factor based on distance
 * Long travel (especially cross-country) penalizes away team
 */
export function calculateTravelFactor(awayTravelMiles: number): number {
  // No travel = 0, cross-country (~2500 miles) = 0.2 advantage for home
  if (awayTravelMiles < 500) return 0;
  if (awayTravelMiles < 1000) return 0.05;
  if (awayTravelMiles < 1500) return 0.1;
  if (awayTravelMiles < 2000) return 0.15;
  return 0.2;
}

/**
 * Calculate injury impact factor
 * Impact values should be pre-calculated based on player importance
 * Values from 0 (no impact) to 1 (star player out)
 */
export function calculateInjuryFactor(
  homeInjuryImpact: number,
  awayInjuryImpact: number
): number {
  // Return differential (positive = home advantage from away injuries)
  return awayInjuryImpact - homeInjuryImpact;
}

/**
 * Get days since last game
 */
export function getDaysSinceGame(lastGameDate: Date | string, currentDate: Date = new Date()): number {
  const last = typeof lastGameDate === 'string' ? new Date(lastGameDate) : lastGameDate;
  const diffTime = currentDate.getTime() - last.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculate L10 record from recent games
 */
export function calculateL10Record(
  recentGames: Game[],
  teamId: number
): { wins: number; losses: number } {
  const last10 = recentGames.slice(0, 10);
  let wins = 0;
  let losses = 0;

  for (const game of last10) {
    if (game.status !== 'Final') continue;

    const isHome = game.home_team.id === teamId;
    const teamScore = isHome ? game.home_team_score : game.visitor_team_score;
    const oppScore = isHome ? game.visitor_team_score : game.home_team_score;

    if (teamScore > oppScore) {
      wins++;
    } else {
      losses++;
    }
  }

  return { wins, losses };
}

/**
 * Combine all factors into a single prediction adjustment
 * Returns a value that adjusts the base ELO prediction
 */
export function combineFactors(factors: PredictionFactors): number {
  let totalAdjustment = 0;

  // Each factor contribution is already weighted
  totalAdjustment += factors.recentForm.contribution;
  totalAdjustment += factors.homeCourt.contribution;
  totalAdjustment += factors.restAdvantage.contribution;
  totalAdjustment += factors.headToHead.contribution;
  totalAdjustment += factors.travel.contribution;
  totalAdjustment += factors.injuries.contribution;

  // Note: ELO difference is handled separately as the base prediction

  return totalAdjustment;
}

/**
 * Convert factor adjustment to probability adjustment
 * Factors are on -1 to 1 scale, we convert to probability shift
 */
export function factorToProbabilityAdjustment(factorValue: number, weight: number): number {
  // Max adjustment is ±10% probability per factor
  return factorValue * weight * 0.1;
}
