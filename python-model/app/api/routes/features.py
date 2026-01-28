"""
Feature retrieval endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class TeamFeaturesResponse(BaseModel):
    """Response model for team features."""
    team_id: str
    team_name: str
    season: int

    # Raw ratings
    off_rating: float
    def_rating: float
    net_rating: float
    pace: float

    # Adjusted ratings
    adj_off_rating: Optional[float]
    adj_def_rating: Optional[float]
    adj_net_rating: Optional[float]

    # Four Factors
    efg_pct: float
    tov_pct: float
    oreb_pct: float
    ftr: float
    opp_efg_pct: float
    opp_tov_pct: float
    opp_oreb_pct: float
    opp_ftr: float

    # BPM
    team_bpm: Optional[float]
    top_5_bpm: Optional[float]


class FeatureImportanceResponse(BaseModel):
    """Response model for feature importance."""
    features: dict[str, float]
    model_version: str


@router.get("/team/{team_id}", response_model=TeamFeaturesResponse)
async def get_team_features(team_id: str, season: Optional[int] = None):
    """
    Get computed features for a specific team.

    This endpoint retrieves the latest advanced stats and computed
    features for prediction use.
    """
    # TODO: Implement database lookup
    # For now, return a 501 Not Implemented
    raise HTTPException(
        status_code=501,
        detail="Team features endpoint not yet implemented. Use /predict with explicit features.",
    )


@router.get("/importance", response_model=FeatureImportanceResponse)
async def get_feature_importance():
    """
    Get feature importance from the trained model.

    Returns the relative importance of each feature
    in the XGBoost model.
    """
    # TODO: Implement model feature importance extraction
    raise HTTPException(
        status_code=501,
        detail="Feature importance endpoint not yet implemented.",
    )
