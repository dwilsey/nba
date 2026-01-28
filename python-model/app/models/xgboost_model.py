"""
XGBoost model wrapper for NBA game predictions.
"""
import numpy as np
import xgboost as xgb
from typing import Optional
import math


# Feature order must match training
FEATURE_ORDER = [
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


class XGBoostNBAModel:
    """Wrapper for XGBoost NBA prediction model."""

    def __init__(self, model: xgb.Booster, feature_names: list[str] = None):
        """
        Initialize the model wrapper.

        Args:
            model: Trained XGBoost Booster
            feature_names: List of feature names in order
        """
        self.model = model
        self.feature_names = feature_names or FEATURE_ORDER

    def _prepare_features(self, features: dict) -> xgb.DMatrix:
        """
        Convert feature dictionary to DMatrix for prediction.

        Args:
            features: Dictionary of feature name -> value

        Returns:
            XGBoost DMatrix
        """
        # Extract features in correct order
        feature_values = []
        for name in self.feature_names:
            value = features.get(name, 0.0)
            # Handle None values
            if value is None:
                value = 0.0
            feature_values.append(float(value))

        # Create numpy array and DMatrix
        X = np.array([feature_values])
        return xgb.DMatrix(X, feature_names=self.feature_names)

    def predict_proba(self, features: dict) -> float:
        """
        Predict home team win probability.

        Args:
            features: Dictionary of features

        Returns:
            Home team win probability (0-1)
        """
        dmatrix = self._prepare_features(features)
        prob = self.model.predict(dmatrix)[0]
        return float(prob)

    def predict(self, features: dict) -> dict:
        """
        Generate full prediction for a game.

        Args:
            features: Dictionary of features

        Returns:
            Dictionary with prediction details
        """
        home_win_prob = self.predict_proba(features)
        away_win_prob = 1 - home_win_prob

        # Calculate confidence based on probability distance from 0.5
        confidence = abs(home_win_prob - 0.5) * 2  # Scale to 0-1

        # Predict spread from net rating differential
        # Roughly 1 point of NRTG diff = 1 point spread
        adj_nrtg_diff = features.get("adj_nrtg_diff", 0)
        predicted_spread = -adj_nrtg_diff  # Negative = home favored

        # Adjust spread based on probability
        # Calibrate: 60% prob ≈ 3 point favorite
        prob_based_spread = self._prob_to_spread(home_win_prob)

        # Average the two methods
        predicted_spread = (predicted_spread + prob_based_spread) / 2

        # Predict total if pace data available
        projected_pace = features.get("projected_game_pace", 0)
        home_ortg = features.get("home_adj_ortg", 110)
        away_ortg = features.get("away_adj_ortg", 110)

        predicted_total = None
        if projected_pace > 0 and home_ortg > 0 and away_ortg > 0:
            # Simple total estimation
            avg_ortg = (home_ortg + away_ortg) / 2
            predicted_total = (avg_ortg / 100) * projected_pace * 2

        return {
            "home_win_prob": round(home_win_prob, 4),
            "away_win_prob": round(away_win_prob, 4),
            "predicted_spread": round(predicted_spread, 1),
            "predicted_total": round(predicted_total, 1) if predicted_total else None,
            "confidence": round(confidence, 4),
        }

    def _prob_to_spread(self, prob: float) -> float:
        """
        Convert win probability to predicted spread.

        Uses inverse logistic function calibrated to NBA data.
        ~60% = -3 points, ~70% = -6 points, ~80% = -10 points

        Args:
            prob: Win probability (0-1)

        Returns:
            Predicted spread (negative = favored)
        """
        # Avoid log(0) errors
        prob = max(0.01, min(0.99, prob))

        # Inverse logistic: spread = -k * ln(p / (1-p))
        # Calibrated so 60% ≈ 3, 70% ≈ 6, 80% ≈ 10
        k = 4.0  # Scaling factor

        log_odds = math.log(prob / (1 - prob))
        spread = -k * log_odds

        return spread

    def get_feature_importance(self) -> dict[str, float]:
        """
        Get feature importance scores from the model.

        Returns:
            Dictionary mapping feature names to importance scores
        """
        importance = self.model.get_score(importance_type="gain")

        # Normalize to sum to 1
        total = sum(importance.values()) if importance else 1
        normalized = {k: v / total for k, v in importance.items()}

        return normalized

    def predict_batch(self, features_list: list[dict]) -> list[dict]:
        """
        Generate predictions for multiple games.

        Args:
            features_list: List of feature dictionaries

        Returns:
            List of prediction dictionaries
        """
        return [self.predict(f) for f in features_list]


class FallbackModel:
    """
    Simple fallback model when XGBoost model is not available.

    Uses adjusted net rating differential for predictions.
    """

    def predict(self, features: dict) -> dict:
        """Generate prediction using simple NRTG formula."""
        adj_nrtg_diff = features.get("adj_nrtg_diff", 0)

        # Logistic function for probability
        k = 0.15
        home_win_prob = 1 / (1 + math.exp(-k * adj_nrtg_diff))
        away_win_prob = 1 - home_win_prob

        confidence = abs(home_win_prob - 0.5) * 2

        return {
            "home_win_prob": round(home_win_prob, 4),
            "away_win_prob": round(away_win_prob, 4),
            "predicted_spread": round(-adj_nrtg_diff, 1),
            "predicted_total": None,
            "confidence": round(confidence, 4),
        }

    def predict_proba(self, features: dict) -> float:
        """Predict home win probability."""
        return self.predict(features)["home_win_prob"]
