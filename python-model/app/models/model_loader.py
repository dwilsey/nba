"""
Model loading utilities.
"""
import os
import json
from typing import Optional

import xgboost as xgb

from app.models.xgboost_model import XGBoostNBAModel, FallbackModel, FEATURE_ORDER


def load_model(model_path: str) -> XGBoostNBAModel:
    """
    Load a trained XGBoost model from file.

    Supports both JSON and binary formats.

    Args:
        model_path: Path to the model file

    Returns:
        XGBoostNBAModel wrapper

    Raises:
        FileNotFoundError: If model file doesn't exist
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}")

    # Create booster and load model
    booster = xgb.Booster()

    if model_path.endswith(".json"):
        booster.load_model(model_path)
    elif model_path.endswith(".bin") or model_path.endswith(".ubj"):
        booster.load_model(model_path)
    else:
        # Try JSON format by default
        booster.load_model(model_path)

    # Try to load feature names from accompanying metadata file
    feature_names = FEATURE_ORDER
    metadata_path = model_path.replace(".json", "_metadata.json").replace(".bin", "_metadata.json")

    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
            feature_names = metadata.get("feature_names", FEATURE_ORDER)

    return XGBoostNBAModel(booster, feature_names)


def load_model_or_fallback(model_path: str) -> XGBoostNBAModel | FallbackModel:
    """
    Load XGBoost model or return fallback if not available.

    Args:
        model_path: Path to the model file

    Returns:
        XGBoostNBAModel or FallbackModel
    """
    try:
        return load_model(model_path)
    except FileNotFoundError:
        print(f"Model not found at {model_path}, using fallback model")
        return FallbackModel()
    except Exception as e:
        print(f"Error loading model: {e}, using fallback model")
        return FallbackModel()


def save_model(
    model: xgb.Booster,
    model_path: str,
    feature_names: list[str] = None,
    metadata: dict = None,
) -> None:
    """
    Save a trained model and its metadata.

    Args:
        model: Trained XGBoost Booster
        model_path: Path to save the model
        feature_names: List of feature names
        metadata: Additional metadata to save
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(model_path) or ".", exist_ok=True)

    # Save model
    model.save_model(model_path)

    # Save metadata
    metadata_path = model_path.replace(".json", "_metadata.json").replace(".bin", "_metadata.json")
    meta = metadata or {}
    meta["feature_names"] = feature_names or FEATURE_ORDER

    with open(metadata_path, "w") as f:
        json.dump(meta, f, indent=2)


def get_model_info(model_path: str) -> Optional[dict]:
    """
    Get information about a saved model.

    Args:
        model_path: Path to the model file

    Returns:
        Dictionary with model info or None if not found
    """
    if not os.path.exists(model_path):
        return None

    metadata_path = model_path.replace(".json", "_metadata.json").replace(".bin", "_metadata.json")

    info = {
        "path": model_path,
        "size_bytes": os.path.getsize(model_path),
        "modified": os.path.getmtime(model_path),
    }

    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            info["metadata"] = json.load(f)

    return info
