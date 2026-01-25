// ELO System
export {
  expectedWinProbability,
  marginOfVictoryMultiplier,
  updateElo,
  calculateGameEloUpdate,
  eloToSpread,
  spreadToElo,
  regressEloForNewSeason,
  calculateWinProbability,
  getConfidenceLevel,
  ELO_CONFIG,
} from './elo';

// Prediction Factors
export {
  type PredictionFactors,
  FACTOR_WEIGHTS,
  calculateRecentFormFactor,
  calculateRestFactor,
  calculateHeadToHeadFactor,
  calculateTravelFactor,
  calculateInjuryFactor,
  getDaysSinceGame,
  calculateL10Record,
  combineFactors,
  factorToProbabilityAdjustment,
} from './factors';

// Main Prediction Model
export {
  type GamePrediction,
  type PredictionInput,
  generatePrediction,
  formatPrediction,
} from './model';

// Value Bet Analysis
export {
  type ValueBetResult,
  type ValueAnalysis,
  americanToImpliedProb,
  americanToDecimal,
  calculateExpectedValue,
  calculateEdge,
  analyzeValueBet,
  analyzeGameValue,
  calculateKellyBetSize,
  formatValueBet,
  getValueTier,
} from './value';

// Player Props
export {
  type PropType,
  type PlayerPropInput,
  type PlayerPropPrediction,
  type PropPredictionFactors,
  predictPlayerProp,
  getPropTypeName,
} from './props';
