/**
 * Player Props Prediction Model
 *
 * Predicts player statistical outputs for props betting:
 * - Points
 * - Rebounds
 * - Assists
 * - 3-pointers made
 * - Combined stats (PRA, P+A, P+R, etc.)
 */

export type PropType =
  | 'points'
  | 'rebounds'
  | 'assists'
  | 'threes'
  | 'steals'
  | 'blocks'
  | 'turnovers'
  | 'pra' // Points + Rebounds + Assists
  | 'pr'  // Points + Rebounds
  | 'pa'  // Points + Assists
  | 'ra'; // Rebounds + Assists

export interface PlayerPropInput {
  playerId: number;
  playerName: string;
  teamId: number;
  propType: PropType;
  line: number;

  // Season averages
  seasonAvg: number;
  gamesPlayed: number;

  // Recent performance (last 5-10 games)
  recentAvg: number;
  recentGames: number;
  recentTrend: 'up' | 'down' | 'stable';

  // Matchup factors
  opponentDefRating?: number; // Opponent's defensive rating for this stat
  opponentRank?: number; // Opponent rank vs position (1 = worst defense)

  // Context
  isHome: boolean;
  projectedMinutes?: number;
  isBackToBack?: boolean;
}

export interface PlayerPropPrediction {
  playerId: number;
  playerName: string;
  propType: PropType;
  line: number;

  predictedValue: number;
  overProbability: number;
  underProbability: number;
  confidence: number;

  factors: PropPredictionFactors;
  recommendation: 'over' | 'under' | 'pass';
  edge: number;
}

export interface PropPredictionFactors {
  seasonAverage: {
    value: number;
    weight: number;
    contribution: number;
  };
  recentForm: {
    value: number;
    trend: 'up' | 'down' | 'stable';
    weight: number;
    contribution: number;
  };
  matchup: {
    opponentRating: number;
    adjustment: number;
    weight: number;
    contribution: number;
  };
  context: {
    homeAway: number;
    minutes: number;
    backToBack: number;
    weight: number;
    contribution: number;
  };
}

// Factor weights for prop predictions
const PROP_WEIGHTS = {
  seasonAverage: 0.35,
  recentForm: 0.35,
  matchup: 0.20,
  context: 0.10,
};

/**
 * Generate prop prediction
 */
export function predictPlayerProp(input: PlayerPropInput): PlayerPropPrediction {
  // Calculate each factor's contribution
  const factors = calculatePropFactors(input);

  // Base prediction is weighted average
  const predictedValue =
    factors.seasonAverage.contribution +
    factors.recentForm.contribution +
    factors.matchup.contribution +
    factors.context.contribution;

  // Calculate probability of over/under
  // Use normal distribution approximation
  const stdDev = estimateStdDev(input.propType, input.seasonAvg);
  const zScore = (input.line - predictedValue) / stdDev;

  // Convert z-score to probability
  const overProb = 1 - normalCDF(zScore);
  const underProb = normalCDF(zScore);

  // Calculate confidence based on sample size and factor alignment
  let confidence = calculatePropConfidence(input, factors);

  // Calculate edge (predicted vs line)
  const edge = predictedValue - input.line;
  const edgePercent = edge / input.line;

  // Recommendation
  let recommendation: 'over' | 'under' | 'pass' = 'pass';
  if (overProb > 0.57) recommendation = 'over';
  else if (underProb > 0.57) recommendation = 'under';

  return {
    playerId: input.playerId,
    playerName: input.playerName,
    propType: input.propType,
    line: input.line,
    predictedValue,
    overProbability: overProb,
    underProbability: underProb,
    confidence,
    factors,
    recommendation,
    edge: edgePercent,
  };
}

/**
 * Calculate all prop prediction factors
 */
function calculatePropFactors(input: PlayerPropInput): PropPredictionFactors {
  // Season average factor
  const seasonContribution = input.seasonAvg * PROP_WEIGHTS.seasonAverage;

  // Recent form factor (weight recent games more heavily)
  const recentMultiplier = input.recentTrend === 'up' ? 1.05 :
                          input.recentTrend === 'down' ? 0.95 : 1.0;
  const recentContribution = input.recentAvg * recentMultiplier * PROP_WEIGHTS.recentForm;

  // Matchup adjustment
  let matchupAdjustment = 0;
  if (input.opponentRank) {
    // Top 10 defense = negative adjustment, Bottom 10 = positive
    // Rank 1-10: -10% to -1%, Rank 11-20: neutral, Rank 21-30: +1% to +10%
    if (input.opponentRank <= 10) {
      matchupAdjustment = -0.01 * (11 - input.opponentRank);
    } else if (input.opponentRank > 20) {
      matchupAdjustment = 0.01 * (input.opponentRank - 20);
    }
  }
  const matchupBase = (input.seasonAvg + input.recentAvg) / 2;
  const matchupContribution = matchupBase * (1 + matchupAdjustment) * PROP_WEIGHTS.matchup;

  // Context adjustment
  let contextMultiplier = 1.0;

  // Home/away (small effect for props)
  contextMultiplier *= input.isHome ? 1.02 : 0.98;

  // Back to back (negative for most stats)
  if (input.isBackToBack) {
    contextMultiplier *= 0.95;
  }

  // Minutes projection
  if (input.projectedMinutes) {
    const avgMinutes = 32; // Assume average
    const minutesRatio = input.projectedMinutes / avgMinutes;
    contextMultiplier *= Math.min(1.15, Math.max(0.85, minutesRatio));
  }

  const contextBase = (input.seasonAvg + input.recentAvg) / 2;
  const contextContribution = contextBase * contextMultiplier * PROP_WEIGHTS.context;

  return {
    seasonAverage: {
      value: input.seasonAvg,
      weight: PROP_WEIGHTS.seasonAverage,
      contribution: seasonContribution,
    },
    recentForm: {
      value: input.recentAvg,
      trend: input.recentTrend,
      weight: PROP_WEIGHTS.recentForm,
      contribution: recentContribution,
    },
    matchup: {
      opponentRating: input.opponentDefRating || 0,
      adjustment: matchupAdjustment,
      weight: PROP_WEIGHTS.matchup,
      contribution: matchupContribution,
    },
    context: {
      homeAway: input.isHome ? 1.02 : 0.98,
      minutes: input.projectedMinutes || 32,
      backToBack: input.isBackToBack ? 0.95 : 1.0,
      weight: PROP_WEIGHTS.context,
      contribution: contextContribution,
    },
  };
}

/**
 * Estimate standard deviation for prop type
 * Based on typical variance for NBA stats
 */
function estimateStdDev(propType: PropType, average: number): number {
  // Standard deviation is roughly proportional to the mean
  // with different coefficients per stat type
  const cvMap: Record<PropType, number> = {
    points: 0.35,     // Points vary moderately
    rebounds: 0.40,   // Rebounds vary more
    assists: 0.45,    // Assists vary significantly
    threes: 0.60,     // 3PM highly variable
    steals: 0.70,     // Steals very variable
    blocks: 0.75,     // Blocks very variable
    turnovers: 0.50,  // TOs moderately variable
    pra: 0.25,        // Combined stats less variable
    pr: 0.30,
    pa: 0.30,
    ra: 0.35,
  };

  const cv = cvMap[propType] || 0.40;
  return average * cv;
}

/**
 * Calculate confidence in prop prediction
 */
function calculatePropConfidence(
  input: PlayerPropInput,
  factors: PropPredictionFactors
): number {
  let confidence = 0.5;

  // More games = higher confidence
  if (input.gamesPlayed >= 60) confidence += 0.15;
  else if (input.gamesPlayed >= 40) confidence += 0.10;
  else if (input.gamesPlayed >= 20) confidence += 0.05;

  // Consistent recent performance = higher confidence
  const seasonToRecent = Math.abs(input.seasonAvg - input.recentAvg) / input.seasonAvg;
  if (seasonToRecent < 0.10) confidence += 0.10;
  else if (seasonToRecent < 0.20) confidence += 0.05;
  else confidence -= 0.05;

  // Strong matchup data = higher confidence
  if (input.opponentRank) confidence += 0.05;

  return Math.min(0.85, Math.max(0.40, confidence));
}

/**
 * Normal CDF approximation
 */
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Get prop type display name
 */
export function getPropTypeName(propType: PropType): string {
  const names: Record<PropType, string> = {
    points: 'Points',
    rebounds: 'Rebounds',
    assists: 'Assists',
    threes: '3-Pointers Made',
    steals: 'Steals',
    blocks: 'Blocks',
    turnovers: 'Turnovers',
    pra: 'Pts + Reb + Ast',
    pr: 'Pts + Reb',
    pa: 'Pts + Ast',
    ra: 'Reb + Ast',
  };
  return names[propType] || propType;
}
