"""
XGBoost model training script.

Usage:
    python -m training.train --output models/xgb_nba_v1.json
"""
import argparse
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import xgboost as xgb
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score

from training.historical_data import HistoricalDataLoader, load_sample_data
from app.models.model_loader import save_model


def train_model(
    X_train,
    y_train,
    X_val=None,
    y_val=None,
    params: dict = None,
    num_rounds: int = 500,
    early_stopping_rounds: int = 50,
) -> xgb.Booster:
    """
    Train an XGBoost model.

    Args:
        X_train: Training features
        y_train: Training labels
        X_val: Validation features (optional)
        y_val: Validation labels (optional)
        params: XGBoost parameters
        num_rounds: Maximum training rounds
        early_stopping_rounds: Early stopping patience

    Returns:
        Trained XGBoost Booster
    """
    # Default parameters optimized for NBA prediction
    default_params = {
        "objective": "binary:logistic",
        "eval_metric": ["logloss", "auc"],
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 3,
        "gamma": 0.1,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "seed": 42,
    }

    if params:
        default_params.update(params)

    # Create DMatrix objects
    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=list(X_train.columns))

    evals = [(dtrain, "train")]
    if X_val is not None and y_val is not None:
        dval = xgb.DMatrix(X_val, label=y_val, feature_names=list(X_val.columns))
        evals.append((dval, "eval"))

    # Train model
    model = xgb.train(
        default_params,
        dtrain,
        num_boost_round=num_rounds,
        evals=evals,
        early_stopping_rounds=early_stopping_rounds if X_val is not None else None,
        verbose_eval=50,
    )

    return model


def evaluate_model(model: xgb.Booster, X_test, y_test) -> dict:
    """
    Evaluate model performance.

    Args:
        model: Trained model
        X_test: Test features
        y_test: Test labels

    Returns:
        Dictionary with evaluation metrics
    """
    dtest = xgb.DMatrix(X_test, feature_names=list(X_test.columns))

    # Get predictions
    y_prob = model.predict(dtest)
    y_pred = (y_prob > 0.5).astype(int)

    # Calculate metrics
    accuracy = accuracy_score(y_test, y_pred)
    logloss = log_loss(y_test, y_prob)
    auc = roc_auc_score(y_test, y_prob)

    # Calibration by confidence bucket
    buckets = {}
    for threshold in [0.5, 0.55, 0.6, 0.65, 0.7]:
        mask = np.abs(y_prob - 0.5) >= (threshold - 0.5)
        if mask.sum() > 0:
            bucket_acc = accuracy_score(y_test[mask], y_pred[mask])
            buckets[f">{threshold:.0%}"] = {
                "accuracy": bucket_acc,
                "count": int(mask.sum()),
            }

    return {
        "accuracy": accuracy,
        "log_loss": logloss,
        "auc_roc": auc,
        "total_games": len(y_test),
        "predicted_home_wins": int(y_pred.sum()),
        "actual_home_wins": int(y_test.sum()),
        "calibration": buckets,
    }


def main():
    parser = argparse.ArgumentParser(description="Train XGBoost NBA prediction model")
    parser.add_argument(
        "--output",
        type=str,
        default="models/xgb_nba_v1.json",
        help="Output path for trained model",
    )
    parser.add_argument(
        "--use-sample-data",
        action="store_true",
        help="Use synthetic sample data instead of database",
    )
    parser.add_argument(
        "--start-date",
        type=str,
        default="2019-10-01",
        help="Start date for training data",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of data for testing",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("XGBoost NBA Prediction Model Training")
    print("=" * 60)

    # Load data
    print("\n1. Loading data...")
    if args.use_sample_data:
        print("   Using synthetic sample data")
        df = load_sample_data()
        loader = HistoricalDataLoader()
        df = loader._calculate_features(df)
    else:
        print(f"   Loading from database (start: {args.start_date})")
        loader = HistoricalDataLoader()
        df = loader.load_games(start_date=args.start_date)

    print(f"   Loaded {len(df)} games")

    # Prepare data
    print("\n2. Preparing train/test split...")
    X_train, X_test, y_train, y_test = loader.prepare_training_data(
        df, test_size=args.test_size
    )
    print(f"   Training set: {len(X_train)} games")
    print(f"   Test set: {len(X_test)} games")

    # Split training into train/validation
    from sklearn.model_selection import train_test_split

    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.15, random_state=42
    )

    # Train model
    print("\n3. Training model...")
    model = train_model(
        X_train,
        y_train,
        X_val,
        y_val,
        num_rounds=500,
        early_stopping_rounds=50,
    )

    # Evaluate
    print("\n4. Evaluating model...")
    metrics = evaluate_model(model, X_test, y_test)

    print(f"\n   Results:")
    print(f"   - Accuracy: {metrics['accuracy']:.2%}")
    print(f"   - Log Loss: {metrics['log_loss']:.4f}")
    print(f"   - AUC-ROC:  {metrics['auc_roc']:.4f}")
    print(f"\n   Calibration by confidence:")
    for bucket, stats in metrics.get("calibration", {}).items():
        print(f"   - {bucket}: {stats['accuracy']:.2%} ({stats['count']} games)")

    # Save model
    print(f"\n5. Saving model to {args.output}...")
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    metadata = {
        "trained_at": datetime.utcnow().isoformat(),
        "training_games": len(X_train) + len(X_val),
        "test_games": len(X_test),
        "metrics": metrics,
        "version": "v1.0.0",
    }

    save_model(
        model,
        args.output,
        feature_names=loader.get_feature_columns(),
        metadata=metadata,
    )

    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
