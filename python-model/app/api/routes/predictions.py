"""
Prediction endpoints for XGBoost NBA model.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.config import get_settings
from app.models.xgboost_model import XGBoostNBAModel
from app.features.adjusted_rating import calculate_adjusted_ratings
from app.features.four_factors import calculate_four_factors_differential
from app.features.pace_metrics import calculate_pace_metrics
from app.features.player_impact import calculate_bpm_differential
from app.features.line_movement import calculate_line_movement_features

router = APIRouter()
settings = get_settings()


class TeamFeatures(BaseModel):
    """Input features for a single team."""
    team_id: str
    team_name: str

    # Raw ratings
    off_rating: float = Field(..., description="Offensive rating (pts per 100 poss)")
    def_rating: float = Field(..., description="Defensive rating (pts per 100 poss)")
    net_rating: float = Field(..., description="Net rating")
    pace: float = Field(..., description="Possessions per 48 minutes")

    # Four Factors
    efg_pct: float = Field(..., description="Effective field goal %")
    tov_pct: float = Field(..., description="Turnover %")
    oreb_pct: float = Field(..., description="Offensive rebound %")
    ftr: float = Field(..., description="Free throw rate")
    opp_efg_pct: float = Field(..., description="Opponent eFG%")
    opp_tov_pct: float = Field(..., description="Opponent TOV%")
    opp_oreb_pct: float = Field(..., description="Opponent OREB%")
    opp_ftr: float = Field(..., description="Opponent FTR")

    # Optional adjusted ratings
    adj_off_rating: Optional[float] = None
    adj_def_rating: Optional[float] = None
    adj_net_rating: Optional[float] = None

    # BPM data
    team_bpm: Optional[float] = Field(None, description="Team aggregate BPM")
    top_5_bpm: Optional[float] = Field(None, description="Top 5 players BPM")


class PredictionRequest(BaseModel):
    """Request model for single game prediction."""
    game_id: str
    home_team: TeamFeatures
    away_team: TeamFeatures

    # Optional line movement data
    opening_spread: Optional[float] = Field(None, description="Opening spread (negative = home favored)")
    current_spread: Optional[float] = Field(None, description="Current/closing spread")
    opening_total: Optional[float] = None
    current_total: Optional[float] = None

    # Strength of schedule (for adjusted ratings)
    home_sos_ortg: Optional[float] = Field(None, description="Home team SOS offensive rating")
    home_sos_drtg: Optional[float] = Field(None, description="Home team SOS defensive rating")
    away_sos_ortg: Optional[float] = Field(None, description="Away team SOS offensive rating")
    away_sos_drtg: Optional[float] = Field(None, description="Away team SOS defensive rating")
    league_avg_ortg: Optional[float] = Field(110.0, description="League average ORTG")
    league_avg_drtg: Optional[float] = Field(110.0, description="League average DRTG")


class PredictionResponse(BaseModel):
    """Response model for game prediction."""
    game_id: str
    home_team: str
    away_team: str
    home_win_probability: float
    away_win_probability: float
    predicted_winner: str
    predicted_spread: float
    predicted_total: Optional[float]
    confidence: float
    model_version: str
    feature_vector: dict
    generated_at: datetime


class BatchPredictionRequest(BaseModel):
    """Request model for batch predictions."""
    games: list[PredictionRequest]


class BatchPredictionResponse(BaseModel):
    """Response model for batch predictions."""
    predictions: list[PredictionResponse]
    total_games: int
    model_version: str


def build_feature_vector(request: PredictionRequest) -> dict:
    """
    Build the 20-feature vector from the request data.

    Features:
    1. adj_nrtg_diff - Adjusted net rating differential
    2. home_adj_ortg - Home team adjusted offensive rating
    3. home_adj_drtg - Home team adjusted defensive rating
    4. away_adj_ortg - Away team adjusted offensive rating
    5. away_adj_drtg - Away team adjusted defensive rating
    6. efg_diff - eFG% differential
    7. tov_diff - TOV% differential (inverted - lower is better)
    8. oreb_diff - OREB% differential
    9. ftr_diff - FTR differential
    10. def_efg_diff - Defensive eFG% differential (opponent eFG%)
    11. def_tov_diff - Defensive TOV% differential (opponent TOV%)
    12. def_oreb_diff - Defensive OREB% differential (opponent OREB%)
    13. def_ftr_diff - Defensive FTR differential (opponent FTR)
    14. four_factors_composite - Weighted composite score
    15. pace_diff - Pace differential
    16. projected_game_pace - Projected game pace
    17. bpm_diff - Team BPM differential
    18. top_5_bpm_diff - Top 5 players BPM differential
    19. spread_movement - Line movement (current - opening)
    20. opening_spread - Opening spread value
    """
    home = request.home_team
    away = request.away_team

    # Calculate adjusted ratings if not provided
    adj_ratings = calculate_adjusted_ratings(
        home_ortg=home.off_rating,
        home_drtg=home.def_rating,
        away_ortg=away.off_rating,
        away_drtg=away.def_rating,
        home_sos_ortg=request.home_sos_ortg,
        home_sos_drtg=request.home_sos_drtg,
        away_sos_ortg=request.away_sos_ortg,
        away_sos_drtg=request.away_sos_drtg,
        league_avg_ortg=request.league_avg_ortg or 110.0,
        league_avg_drtg=request.league_avg_drtg or 110.0,
        home_adj_ortg=home.adj_off_rating,
        home_adj_drtg=home.adj_def_rating,
        away_adj_ortg=away.adj_off_rating,
        away_adj_drtg=away.adj_def_rating,
    )

    # Calculate four factors differentials
    four_factors = calculate_four_factors_differential(
        home_efg=home.efg_pct,
        home_tov=home.tov_pct,
        home_oreb=home.oreb_pct,
        home_ftr=home.ftr,
        home_opp_efg=home.opp_efg_pct,
        home_opp_tov=home.opp_tov_pct,
        home_opp_oreb=home.opp_oreb_pct,
        home_opp_ftr=home.opp_ftr,
        away_efg=away.efg_pct,
        away_tov=away.tov_pct,
        away_oreb=away.oreb_pct,
        away_ftr=away.ftr,
        away_opp_efg=away.opp_efg_pct,
        away_opp_tov=away.opp_tov_pct,
        away_opp_oreb=away.opp_oreb_pct,
        away_opp_ftr=away.opp_ftr,
    )

    # Calculate pace metrics
    pace = calculate_pace_metrics(home.pace, away.pace)

    # Calculate BPM differentials
    bpm = calculate_bpm_differential(
        home_bpm=home.team_bpm,
        away_bpm=away.team_bpm,
        home_top_5_bpm=home.top_5_bpm,
        away_top_5_bpm=away.top_5_bpm,
    )

    # Calculate line movement features
    line = calculate_line_movement_features(
        opening_spread=request.opening_spread,
        current_spread=request.current_spread,
    )

    return {
        # Adjusted ratings (1-5)
        "adj_nrtg_diff": adj_ratings["adj_nrtg_diff"],
        "home_adj_ortg": adj_ratings["home_adj_ortg"],
        "home_adj_drtg": adj_ratings["home_adj_drtg"],
        "away_adj_ortg": adj_ratings["away_adj_ortg"],
        "away_adj_drtg": adj_ratings["away_adj_drtg"],
        # Four factors offense (6-9)
        "efg_diff": four_factors["efg_diff"],
        "tov_diff": four_factors["tov_diff"],
        "oreb_diff": four_factors["oreb_diff"],
        "ftr_diff": four_factors["ftr_diff"],
        # Four factors defense (10-13)
        "def_efg_diff": four_factors["def_efg_diff"],
        "def_tov_diff": four_factors["def_tov_diff"],
        "def_oreb_diff": four_factors["def_oreb_diff"],
        "def_ftr_diff": four_factors["def_ftr_diff"],
        # Four factors composite (14)
        "four_factors_composite": four_factors["composite"],
        # Pace (15-16)
        "pace_diff": pace["pace_diff"],
        "projected_game_pace": pace["projected_pace"],
        # BPM (17-18)
        "bpm_diff": bpm["bpm_diff"],
        "top_5_bpm_diff": bpm["top_5_bpm_diff"],
        # Line movement (19-20)
        "spread_movement": line["spread_movement"],
        "opening_spread": line["opening_spread"],
    }


@router.post("/", response_model=PredictionResponse)
async def predict_game(request: PredictionRequest, req: Request) -> PredictionResponse:
    """
    Generate prediction for a single game.
    """
    model: XGBoostNBAModel | None = getattr(req.app.state, "model", None)

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please train the model first.",
        )

    # Build feature vector
    feature_vector = build_feature_vector(request)

    # Get prediction from model
    prediction = model.predict(feature_vector)

    return PredictionResponse(
        game_id=request.game_id,
        home_team=request.home_team.team_name,
        away_team=request.away_team.team_name,
        home_win_probability=prediction["home_win_prob"],
        away_win_probability=prediction["away_win_prob"],
        predicted_winner=request.home_team.team_name
        if prediction["home_win_prob"] > 0.5
        else request.away_team.team_name,
        predicted_spread=prediction["predicted_spread"],
        predicted_total=prediction.get("predicted_total"),
        confidence=prediction["confidence"],
        model_version=settings.model_version,
        feature_vector=feature_vector,
        generated_at=datetime.utcnow(),
    )


@router.post("/batch", response_model=BatchPredictionResponse)
async def predict_batch(request: BatchPredictionRequest, req: Request) -> BatchPredictionResponse:
    """
    Generate predictions for multiple games in batch.
    """
    model: XGBoostNBAModel | None = getattr(req.app.state, "model", None)

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please train the model first.",
        )

    predictions = []
    for game_request in request.games:
        feature_vector = build_feature_vector(game_request)
        prediction = model.predict(feature_vector)

        predictions.append(
            PredictionResponse(
                game_id=game_request.game_id,
                home_team=game_request.home_team.team_name,
                away_team=game_request.away_team.team_name,
                home_win_probability=prediction["home_win_prob"],
                away_win_probability=prediction["away_win_prob"],
                predicted_winner=game_request.home_team.team_name
                if prediction["home_win_prob"] > 0.5
                else game_request.away_team.team_name,
                predicted_spread=prediction["predicted_spread"],
                predicted_total=prediction.get("predicted_total"),
                confidence=prediction["confidence"],
                model_version=settings.model_version,
                feature_vector=feature_vector,
                generated_at=datetime.utcnow(),
            )
        )

    return BatchPredictionResponse(
        predictions=predictions,
        total_games=len(predictions),
        model_version=settings.model_version,
    )
