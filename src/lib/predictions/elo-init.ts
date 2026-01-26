/**
 * ELO Initialization and Estimation
 *
 * When EloHistory table is empty (no historical data), we need to estimate
 * initial ELO ratings from team performance metrics.
 *
 * This prevents the "all teams have +4 spread" problem where every team
 * defaults to 1500 ELO and only home court advantage differentiates them.
 */

import { ELO_CONFIG } from './elo';

/**
 * Estimate ELO from win percentage
 *
 * A 50% win rate = 1500 ELO (average)
 * A 60% win rate = ~1600 ELO (good team)
 * A 40% win rate = ~1400 ELO (struggling team)
 * A 75% win rate = ~1700 ELO (elite team)
 *
 * The formula maps win% to ELO deviation from 1500:
 * deviation = (winPct - 0.5) * 400
 *
 * @param winPct - Win percentage as decimal (0.0 to 1.0)
 * @returns Estimated ELO rating
 */
export function estimateEloFromWinPct(winPct: number): number {
  // Clamp win percentage to valid range
  const clampedWinPct = Math.max(0, Math.min(1, winPct));

  // Calculate deviation from average (50%)
  // 400 ELO points spans roughly 75% of win% range
  const deviation = (clampedWinPct - 0.5) * 400;

  return Math.round(ELO_CONFIG.INITIAL_ELO + deviation);
}

/**
 * Estimate ELO from team record
 *
 * @param wins - Number of wins
 * @param losses - Number of losses
 * @returns Estimated ELO rating, or default if no games played
 */
export function estimateEloFromRecord(wins: number, losses: number): number {
  const gamesPlayed = wins + losses;

  if (gamesPlayed === 0) {
    return ELO_CONFIG.INITIAL_ELO;
  }

  const winPct = wins / gamesPlayed;
  return estimateEloFromWinPct(winPct);
}

/**
 * Estimate ELO from net rating (point differential per game)
 *
 * Net rating is often a better predictor than win% alone.
 * Approximately 2.5 net rating points = 1 win per 10 games
 *
 * @param netRating - Points scored minus points allowed per game
 * @returns Estimated ELO rating
 */
export function estimateEloFromNetRating(netRating: number): number {
  // Clamp to reasonable range (-15 to +15)
  const clampedRating = Math.max(-15, Math.min(15, netRating));

  // Map net rating to ELO
  // +10 net rating ≈ +150 ELO
  // -10 net rating ≈ -150 ELO
  const deviation = clampedRating * 15;

  return Math.round(ELO_CONFIG.INITIAL_ELO + deviation);
}

/**
 * Estimate ELO using multiple factors
 *
 * Combines win percentage and net rating for more accurate estimation.
 *
 * @param winPct - Win percentage (0.0 to 1.0)
 * @param netRating - Net rating (optional)
 * @param gamesPlayed - Number of games played (affects confidence weighting)
 * @returns Estimated ELO rating
 */
export function estimateEloComprehensive(
  winPct: number,
  netRating?: number,
  gamesPlayed: number = 0
): number {
  const winPctElo = estimateEloFromWinPct(winPct);

  // If we don't have net rating, just use win%
  if (netRating === undefined) {
    return winPctElo;
  }

  const netRatingElo = estimateEloFromNetRating(netRating);

  // Weight net rating more heavily as games played increases
  // (net rating becomes more predictive with larger sample)
  let netRatingWeight = 0.4;
  if (gamesPlayed >= 40) {
    netRatingWeight = 0.5;
  } else if (gamesPlayed >= 20) {
    netRatingWeight = 0.45;
  }

  const blendedElo =
    winPctElo * (1 - netRatingWeight) + netRatingElo * netRatingWeight;

  return Math.round(blendedElo);
}

/**
 * Quick team stats interface for ELO estimation
 */
export interface TeamQuickStats {
  wins: number;
  losses: number;
  pointsPerGame?: number;
  opponentPointsPerGame?: number;
}

/**
 * Estimate ELO from team stats object
 *
 * @param stats - Team stats containing record and optionally scoring data
 * @returns Estimated ELO rating
 */
export function estimateEloFromStats(stats: TeamQuickStats): number {
  const gamesPlayed = stats.wins + stats.losses;

  if (gamesPlayed === 0) {
    return ELO_CONFIG.INITIAL_ELO;
  }

  const winPct = stats.wins / gamesPlayed;

  // Calculate net rating if scoring data available
  if (stats.pointsPerGame !== undefined && stats.opponentPointsPerGame !== undefined) {
    const netRating = stats.pointsPerGame - stats.opponentPointsPerGame;
    return estimateEloComprehensive(winPct, netRating, gamesPlayed);
  }

  return estimateEloFromWinPct(winPct);
}
