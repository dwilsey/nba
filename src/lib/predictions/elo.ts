/**
 * ELO Rating System for NBA Teams
 *
 * Based on the standard ELO formula with NBA-specific adjustments:
 * - K-factor of 20 for regular season, 15 for playoffs
 * - Home court advantage of ~100 ELO points (~3.5 actual points)
 * - Margin of victory multiplier to reward dominant wins appropriately
 */

// Configuration
export const ELO_CONFIG = {
  INITIAL_ELO: 1500,
  K_FACTOR_REGULAR: 20,
  K_FACTOR_PLAYOFF: 15,
  HOME_ADVANTAGE_DEFAULT: 100, // ~3.5 points
  SEASON_REGRESSION: 0.75, // Regress 25% toward mean between seasons
};

/**
 * Calculate expected win probability based on ELO difference
 * @param teamElo - The team's current ELO rating
 * @param opponentElo - The opponent's current ELO rating
 * @returns Probability of team winning (0-1)
 */
export function expectedWinProbability(teamElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - teamElo) / 400));
}

/**
 * Calculate margin of victory multiplier
 * This prevents ELO from overreacting to blowouts while still rewarding dominant wins
 *
 * @param pointDiff - Absolute point differential
 * @param eloDiff - ELO difference (winner - loser)
 * @returns Multiplier for K-factor (typically 1.0 - 2.5)
 */
export function marginOfVictoryMultiplier(pointDiff: number, eloDiff: number): number {
  // Log-based scaling reduces impact of very large margins
  // The denominator adjusts for expected margin based on ELO difference
  const baseMultiplier = Math.log(Math.abs(pointDiff) + 1);
  const eloAdjustment = 2.2 / (0.001 * eloDiff + 2.2);

  return baseMultiplier * eloAdjustment;
}

/**
 * Update ELO rating after a game
 *
 * @param teamElo - Team's ELO before the game
 * @param opponentElo - Opponent's ELO before the game
 * @param won - Whether the team won
 * @param pointDiff - Point differential (positive if team won)
 * @param isPlayoff - Whether this is a playoff game
 * @param homeAdvantage - Home court advantage in ELO points
 * @returns New ELO rating for the team
 */
export function updateElo(
  teamElo: number,
  opponentElo: number,
  won: boolean,
  pointDiff: number,
  isPlayoff: boolean = false,
  homeAdvantage: number = 0
): number {
  // Adjust opponent ELO for home court
  const adjustedOpponentElo = opponentElo - homeAdvantage;

  // Calculate expected outcome
  const expected = expectedWinProbability(teamElo, adjustedOpponentElo);
  const actual = won ? 1 : 0;

  // Get K-factor based on game type
  const kFactor = isPlayoff ? ELO_CONFIG.K_FACTOR_PLAYOFF : ELO_CONFIG.K_FACTOR_REGULAR;

  // Calculate MOV multiplier
  const eloDiff = won ? teamElo - opponentElo : opponentElo - teamElo;
  const movMultiplier = marginOfVictoryMultiplier(Math.abs(pointDiff), eloDiff);

  // Calculate ELO change
  const change = kFactor * movMultiplier * (actual - expected);

  return teamElo + change;
}

/**
 * Calculate both teams' new ELO ratings after a game
 */
export function calculateGameEloUpdate(
  homeElo: number,
  awayElo: number,
  homeScore: number,
  awayScore: number,
  isPlayoff: boolean = false,
  homeAdvantage: number = ELO_CONFIG.HOME_ADVANTAGE_DEFAULT
): { newHomeElo: number; newAwayElo: number; homeChange: number; awayChange: number } {
  const homeWon = homeScore > awayScore;
  const pointDiff = homeScore - awayScore;

  const newHomeElo = updateElo(
    homeElo,
    awayElo,
    homeWon,
    pointDiff,
    isPlayoff,
    homeAdvantage
  );

  const newAwayElo = updateElo(
    awayElo,
    homeElo,
    !homeWon,
    -pointDiff,
    isPlayoff,
    -homeAdvantage // Away team faces home advantage against them
  );

  return {
    newHomeElo,
    newAwayElo,
    homeChange: newHomeElo - homeElo,
    awayChange: newAwayElo - awayElo,
  };
}

/**
 * Convert ELO difference to point spread
 * Approximately 25 ELO points = 1 point spread
 */
export function eloToSpread(eloDiff: number): number {
  return eloDiff / 25;
}

/**
 * Convert point spread to ELO difference
 */
export function spreadToElo(spread: number): number {
  return spread * 25;
}

/**
 * Regress ELO toward mean for new season
 * Teams regress 25% toward 1500 between seasons
 */
export function regressEloForNewSeason(elo: number): number {
  return ELO_CONFIG.INITIAL_ELO + (elo - ELO_CONFIG.INITIAL_ELO) * ELO_CONFIG.SEASON_REGRESSION;
}

/**
 * Calculate win probability from ELO ratings
 * Includes home court advantage
 */
export function calculateWinProbability(
  homeElo: number,
  awayElo: number,
  homeAdvantage: number = ELO_CONFIG.HOME_ADVANTAGE_DEFAULT
): { home: number; away: number } {
  // Add home court advantage to home team's effective ELO
  const homeProb = expectedWinProbability(homeElo + homeAdvantage, awayElo);

  return {
    home: homeProb,
    away: 1 - homeProb,
  };
}

/**
 * Get confidence level based on ELO difference
 * Higher difference = higher confidence
 */
export function getConfidenceLevel(eloDiff: number): number {
  const absEloDiff = Math.abs(eloDiff);

  // Map ELO difference to confidence (0-1 scale)
  // 0 diff = 50% confidence, 400+ diff = ~95% confidence
  if (absEloDiff < 50) return 0.5 + absEloDiff * 0.002;
  if (absEloDiff < 100) return 0.6 + (absEloDiff - 50) * 0.003;
  if (absEloDiff < 200) return 0.75 + (absEloDiff - 100) * 0.001;
  if (absEloDiff < 400) return 0.85 + (absEloDiff - 200) * 0.0005;

  return Math.min(0.95, 0.95 + (absEloDiff - 400) * 0.0001);
}
