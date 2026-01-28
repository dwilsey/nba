"""
Configuration settings for the XGBoost NBA Prediction microservice.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "XGBoost NBA Prediction Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "postgresql://localhost:5432/nba_betting"

    # Model
    model_path: str = "models/xgb_nba_v1.json"
    model_version: str = "v1.0.0"

    # Basketball Reference scraping
    bbref_rate_limit: int = 20  # requests per minute
    bbref_base_url: str = "https://www.basketball-reference.com"

    # Feature weights (from Dean Oliver's research)
    efg_weight: float = 0.40
    tov_weight: float = 0.25
    oreb_weight: float = 0.20
    ftr_weight: float = 0.15

    # Prediction thresholds
    min_confidence: float = 0.52  # Minimum confidence for predictions
    high_confidence_threshold: float = 0.65

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
