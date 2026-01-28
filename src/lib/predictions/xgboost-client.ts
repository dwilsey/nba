/**
 * XGBoost Python service client.
 *
 * Communicates with the Python FastAPI microservice for XGBoost predictions.
 */

const XGBOOST_SERVICE_URL =
  process.env.XGBOOST_SERVICE_URL || "http://localhost:8000";

export interface TeamFeatures {
  team_id: string;
  team_name: string;

  // Raw ratings
  off_rating: number;
  def_rating: number;
  net_rating: number;
  pace: number;

  // Four Factors
  efg_pct: number;
  tov_pct: number;
  oreb_pct: number;
  ftr: number;
  opp_efg_pct: number;
  opp_tov_pct: number;
  opp_oreb_pct: number;
  opp_ftr: number;

  // Optional adjusted ratings
  adj_off_rating?: number;
  adj_def_rating?: number;
  adj_net_rating?: number;

  // BPM data
  team_bpm?: number;
  top_5_bpm?: number;
}

export interface PredictionRequest {
  game_id: string;
  home_team: TeamFeatures;
  away_team: TeamFeatures;

  // Optional line movement data
  opening_spread?: number;
  current_spread?: number;
  opening_total?: number;
  current_total?: number;

  // Strength of schedule
  home_sos_ortg?: number;
  home_sos_drtg?: number;
  away_sos_ortg?: number;
  away_sos_drtg?: number;
  league_avg_ortg?: number;
  league_avg_drtg?: number;
}

export interface XGBoostPrediction {
  game_id: string;
  home_team: string;
  away_team: string;
  home_win_probability: number;
  away_win_probability: number;
  predicted_winner: string;
  predicted_spread: number;
  predicted_total: number | null;
  confidence: number;
  model_version: string;
  feature_vector: Record<string, number>;
  generated_at: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded";
  service: string;
  version: string;
  model_loaded: boolean;
  model_version: string | null;
  timestamp: string;
}

/**
 * XGBoost service client class.
 */
export class XGBoostClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout: number = 10000) {
    this.baseUrl = baseUrl || XGBOOST_SERVICE_URL;
    this.timeout = timeout;
  }

  /**
   * Check if the XGBoost service is healthy and model is loaded.
   */
  async checkHealth(): Promise<HealthStatus> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if the service is ready to accept predictions.
   */
  async isReady(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.status === "healthy" && health.model_loaded;
    } catch {
      return false;
    }
  }

  /**
   * Get a prediction for a single game.
   */
  async predict(request: PredictionRequest): Promise<XGBoostPrediction> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/predict/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.detail || `Prediction failed: ${response.status}`
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get predictions for multiple games in batch.
   */
  async predictBatch(
    requests: PredictionRequest[]
  ): Promise<XGBoostPrediction[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2);

    try {
      const response = await fetch(`${this.baseUrl}/predict/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ games: requests }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.detail || `Batch prediction failed: ${response.status}`
        );
      }

      const result = await response.json();
      return result.predictions;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Singleton instance
let clientInstance: XGBoostClient | null = null;

/**
 * Get the XGBoost client singleton.
 */
export function getXGBoostClient(): XGBoostClient {
  if (!clientInstance) {
    clientInstance = new XGBoostClient();
  }
  return clientInstance;
}

/**
 * Create default team features with league-average values.
 */
export function createDefaultTeamFeatures(
  teamId: string,
  teamName: string
): TeamFeatures {
  return {
    team_id: teamId,
    team_name: teamName,
    off_rating: 110.0,
    def_rating: 110.0,
    net_rating: 0.0,
    pace: 100.0,
    efg_pct: 0.52,
    tov_pct: 0.14,
    oreb_pct: 0.25,
    ftr: 0.25,
    opp_efg_pct: 0.52,
    opp_tov_pct: 0.14,
    opp_oreb_pct: 0.25,
    opp_ftr: 0.25,
  };
}

/**
 * Build team features from database stats.
 */
export function buildTeamFeatures(
  teamId: string,
  teamName: string,
  stats: {
    offRating?: number;
    defRating?: number;
    netRating?: number;
    pace?: number;
    efgPct?: number;
    tovPct?: number;
    orebPct?: number;
    ftr?: number;
    oppEfgPct?: number;
    oppTovPct?: number;
    oppOrebPct?: number;
    oppFtr?: number;
    adjOffRating?: number;
    adjDefRating?: number;
    adjNetRating?: number;
  },
  bpmData?: {
    teamBpm?: number;
    top5Bpm?: number;
  }
): TeamFeatures {
  return {
    team_id: teamId,
    team_name: teamName,
    off_rating: stats.offRating ?? 110.0,
    def_rating: stats.defRating ?? 110.0,
    net_rating: stats.netRating ?? 0.0,
    pace: stats.pace ?? 100.0,
    efg_pct: stats.efgPct ?? 0.52,
    tov_pct: stats.tovPct ?? 0.14,
    oreb_pct: stats.orebPct ?? 0.25,
    ftr: stats.ftr ?? 0.25,
    opp_efg_pct: stats.oppEfgPct ?? 0.52,
    opp_tov_pct: stats.oppTovPct ?? 0.14,
    opp_oreb_pct: stats.oppOrebPct ?? 0.25,
    opp_ftr: stats.oppFtr ?? 0.25,
    adj_off_rating: stats.adjOffRating,
    adj_def_rating: stats.adjDefRating,
    adj_net_rating: stats.adjNetRating,
    team_bpm: bpmData?.teamBpm,
    top_5_bpm: bpmData?.top5Bpm,
  };
}
