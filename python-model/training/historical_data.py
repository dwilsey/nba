"""
Historical data preparation for model training.

Loads and prepares training data from the database.
"""
import pandas as pd
import numpy as np
from typing import Optional
from datetime import datetime
from dataclasses import dataclass

from sqlalchemy import create_engine, text
from app.config import get_settings

settings = get_settings()


@dataclass
class GameRecord:
    """A single game record for training."""

    game_id: str
    game_date: datetime
    home_team_id: str
    away_team_id: str
    home_score: int
    away_score: int
    home_won: bool

    # Features
    adj_nrtg_diff: float
    home_adj_ortg: float
    home_adj_drtg: float
    away_adj_ortg: float
    away_adj_drtg: float
    efg_diff: float
    tov_diff: float
    oreb_diff: float
    ftr_diff: float
    def_efg_diff: float
    def_tov_diff: float
    def_oreb_diff: float
    def_ftr_diff: float
    four_factors_composite: float
    pace_diff: float
    projected_game_pace: float
    bpm_diff: float
    top_5_bpm_diff: float
    spread_movement: float
    opening_spread: float


class HistoricalDataLoader:
    """Loads historical game data for training."""

    def __init__(self, database_url: str = None):
        """
        Initialize the data loader.

        Args:
            database_url: PostgreSQL connection string
        """
        self.database_url = database_url or settings.database_url
        self.engine = None

    def connect(self):
        """Establish database connection."""
        self.engine = create_engine(self.database_url)

    def close(self):
        """Close database connection."""
        if self.engine:
            self.engine.dispose()

    def load_games(
        self,
        start_date: str = "2019-10-01",
        end_date: str = None,
        min_games_played: int = 10,
    ) -> pd.DataFrame:
        """
        Load historical games with all features.

        Args:
            start_date: Start of date range
            end_date: End of date range (default: today)
            min_games_played: Minimum games for team stats to be valid

        Returns:
            DataFrame with game features and outcomes
        """
        if not self.engine:
            self.connect()

        end_date = end_date or datetime.now().strftime("%Y-%m-%d")

        # Query to get games with team stats
        query = text("""
            SELECT
                g.id as game_id,
                g.game_date,
                g.home_team as home_team_id,
                g.away_team as away_team_id,
                g.home_score,
                g.away_score,
                g.status,

                -- Home team stats (would need to join advanced stats table)
                -- For now, return placeholders
                110.0 as home_adj_ortg,
                110.0 as home_adj_drtg,
                100.0 as home_pace,
                0.52 as home_efg,
                0.14 as home_tov,
                0.25 as home_oreb,
                0.25 as home_ftr,
                0.52 as home_opp_efg,
                0.14 as home_opp_tov,
                0.25 as home_opp_oreb,
                0.25 as home_opp_ftr,
                0.0 as home_bpm,
                0.0 as home_top_5_bpm,

                -- Away team stats
                110.0 as away_adj_ortg,
                110.0 as away_adj_drtg,
                100.0 as away_pace,
                0.52 as away_efg,
                0.14 as away_tov,
                0.25 as away_oreb,
                0.25 as away_ftr,
                0.52 as away_opp_efg,
                0.14 as away_opp_tov,
                0.25 as away_opp_oreb,
                0.25 as away_opp_ftr,
                0.0 as away_bpm,
                0.0 as away_top_5_bpm,

                -- Line data (from odds_history if available)
                COALESCE(oh.spread, 0) as opening_spread,
                COALESCE(oh_close.spread, oh.spread, 0) as closing_spread

            FROM games g
            LEFT JOIN odds_history oh ON g.id = oh.game_id AND oh.is_closing = false
            LEFT JOIN odds_history oh_close ON g.id = oh_close.game_id AND oh_close.is_closing = true
            WHERE g.game_date >= :start_date
              AND g.game_date <= :end_date
              AND g.status = 'FINAL'
              AND g.home_score IS NOT NULL
              AND g.away_score IS NOT NULL
            ORDER BY g.game_date
        """)

        df = pd.read_sql(
            query,
            self.engine,
            params={"start_date": start_date, "end_date": end_date},
        )

        # Calculate derived features
        df = self._calculate_features(df)

        return df

    def _calculate_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate all model features from raw stats."""
        # Target variable
        df["home_won"] = (df["home_score"] > df["away_score"]).astype(int)

        # Adjusted net rating differential
        df["home_adj_nrtg"] = df["home_adj_ortg"] - df["home_adj_drtg"]
        df["away_adj_nrtg"] = df["away_adj_ortg"] - df["away_adj_drtg"]
        df["adj_nrtg_diff"] = df["home_adj_nrtg"] - df["away_adj_nrtg"] + 3.5  # Home court

        # Four factors differentials
        df["efg_diff"] = df["home_efg"] - df["away_efg"]
        df["tov_diff"] = df["away_tov"] - df["home_tov"]  # Lower is better
        df["oreb_diff"] = df["home_oreb"] - df["away_oreb"]
        df["ftr_diff"] = df["home_ftr"] - df["away_ftr"]

        # Defensive four factors
        df["def_efg_diff"] = df["away_opp_efg"] - df["home_opp_efg"]
        df["def_tov_diff"] = df["home_opp_tov"] - df["away_opp_tov"]
        df["def_oreb_diff"] = df["away_opp_oreb"] - df["home_opp_oreb"]
        df["def_ftr_diff"] = df["away_opp_ftr"] - df["home_opp_ftr"]

        # Four factors composite (using Dean Oliver weights)
        df["four_factors_composite"] = (
            0.40 * df["efg_diff"]
            + 0.25 * df["tov_diff"]
            + 0.20 * df["oreb_diff"]
            + 0.15 * df["ftr_diff"]
            + 0.40 * df["def_efg_diff"]
            + 0.25 * df["def_tov_diff"]
            + 0.20 * df["def_oreb_diff"]
            + 0.15 * df["def_ftr_diff"]
        )

        # Pace metrics
        df["pace_diff"] = df["home_pace"] - df["away_pace"]
        df["projected_game_pace"] = (df["home_pace"] + df["away_pace"]) / 2

        # BPM differentials
        df["bpm_diff"] = df["home_bpm"] - df["away_bpm"]
        df["top_5_bpm_diff"] = df["home_top_5_bpm"] - df["away_top_5_bpm"]

        # Line movement
        df["spread_movement"] = df["closing_spread"] - df["opening_spread"]

        return df

    def get_feature_columns(self) -> list[str]:
        """Get list of feature column names."""
        return [
            "adj_nrtg_diff",
            "home_adj_ortg",
            "home_adj_drtg",
            "away_adj_ortg",
            "away_adj_drtg",
            "efg_diff",
            "tov_diff",
            "oreb_diff",
            "ftr_diff",
            "def_efg_diff",
            "def_tov_diff",
            "def_oreb_diff",
            "def_ftr_diff",
            "four_factors_composite",
            "pace_diff",
            "projected_game_pace",
            "bpm_diff",
            "top_5_bpm_diff",
            "spread_movement",
            "opening_spread",
        ]

    def prepare_training_data(
        self,
        df: pd.DataFrame,
        test_size: float = 0.2,
        random_state: int = 42,
    ) -> tuple:
        """
        Prepare data for training with train/test split.

        Args:
            df: DataFrame with all features
            test_size: Fraction for test set
            random_state: Random seed

        Returns:
            Tuple of (X_train, X_test, y_train, y_test)
        """
        from sklearn.model_selection import train_test_split

        feature_cols = self.get_feature_columns()

        X = df[feature_cols].fillna(0)
        y = df["home_won"]

        return train_test_split(X, y, test_size=test_size, random_state=random_state)

    def prepare_time_series_split(
        self,
        df: pd.DataFrame,
        n_splits: int = 5,
    ) -> list[tuple]:
        """
        Prepare data using time-series cross-validation.

        For sports prediction, we should never train on future data,
        so we use expanding window validation.

        Args:
            df: DataFrame with all features (must be sorted by date)
            n_splits: Number of CV splits

        Returns:
            List of (train_idx, test_idx) tuples
        """
        from sklearn.model_selection import TimeSeriesSplit

        tscv = TimeSeriesSplit(n_splits=n_splits)
        feature_cols = self.get_feature_columns()

        X = df[feature_cols].fillna(0)
        y = df["home_won"]

        splits = []
        for train_idx, test_idx in tscv.split(X):
            splits.append((
                X.iloc[train_idx],
                X.iloc[test_idx],
                y.iloc[train_idx],
                y.iloc[test_idx],
            ))

        return splits


def load_sample_data() -> pd.DataFrame:
    """
    Generate sample data for testing when database is not available.

    Returns:
        DataFrame with synthetic game data
    """
    np.random.seed(42)
    n_games = 1000

    # Generate synthetic features
    data = {
        "game_id": [f"game_{i}" for i in range(n_games)],
        "game_date": pd.date_range("2023-10-01", periods=n_games, freq="D"),
        "home_team_id": np.random.choice(30, n_games),
        "away_team_id": np.random.choice(30, n_games),

        # Adjusted ratings (around league average of 110)
        "home_adj_ortg": np.random.normal(110, 5, n_games),
        "home_adj_drtg": np.random.normal(110, 5, n_games),
        "away_adj_ortg": np.random.normal(110, 5, n_games),
        "away_adj_drtg": np.random.normal(110, 5, n_games),

        # Pace (around league average of 100)
        "home_pace": np.random.normal(100, 3, n_games),
        "away_pace": np.random.normal(100, 3, n_games),

        # Four factors (typical ranges)
        "home_efg": np.random.normal(0.52, 0.02, n_games),
        "home_tov": np.random.normal(0.14, 0.02, n_games),
        "home_oreb": np.random.normal(0.25, 0.03, n_games),
        "home_ftr": np.random.normal(0.25, 0.05, n_games),
        "home_opp_efg": np.random.normal(0.52, 0.02, n_games),
        "home_opp_tov": np.random.normal(0.14, 0.02, n_games),
        "home_opp_oreb": np.random.normal(0.25, 0.03, n_games),
        "home_opp_ftr": np.random.normal(0.25, 0.05, n_games),

        "away_efg": np.random.normal(0.52, 0.02, n_games),
        "away_tov": np.random.normal(0.14, 0.02, n_games),
        "away_oreb": np.random.normal(0.25, 0.03, n_games),
        "away_ftr": np.random.normal(0.25, 0.05, n_games),
        "away_opp_efg": np.random.normal(0.52, 0.02, n_games),
        "away_opp_tov": np.random.normal(0.14, 0.02, n_games),
        "away_opp_oreb": np.random.normal(0.25, 0.03, n_games),
        "away_opp_ftr": np.random.normal(0.25, 0.05, n_games),

        # BPM
        "home_bpm": np.random.normal(0, 2, n_games),
        "home_top_5_bpm": np.random.normal(2, 3, n_games),
        "away_bpm": np.random.normal(0, 2, n_games),
        "away_top_5_bpm": np.random.normal(2, 3, n_games),

        # Line data
        "opening_spread": np.random.normal(0, 5, n_games),
    }

    df = pd.DataFrame(data)

    # Calculate closing spread with some movement
    df["closing_spread"] = df["opening_spread"] + np.random.normal(0, 1, n_games)

    # Generate realistic scores based on features
    home_advantage = 3.5
    rating_diff = (
        (df["home_adj_ortg"] - df["home_adj_drtg"])
        - (df["away_adj_ortg"] - df["away_adj_drtg"])
        + home_advantage
    )

    # Add noise and generate scores
    noise = np.random.normal(0, 10, n_games)
    point_diff = rating_diff + noise

    avg_score = 110
    df["home_score"] = (avg_score + point_diff / 2 + np.random.normal(0, 5, n_games)).astype(int)
    df["away_score"] = (avg_score - point_diff / 2 + np.random.normal(0, 5, n_games)).astype(int)

    return df
