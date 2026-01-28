"""
Hyperparameter tuning for XGBoost model using Optuna.

Usage:
    python -m training.hyperparameter_tuning --n-trials 100
"""
import argparse
from datetime import datetime

import optuna
from optuna.samplers import TPESampler
import xgboost as xgb
import numpy as np
from sklearn.metrics import log_loss, accuracy_score
from sklearn.model_selection import TimeSeriesSplit

from training.historical_data import HistoricalDataLoader, load_sample_data


def create_objective(X, y, n_splits: int = 5):
    """
    Create an Optuna objective function for XGBoost tuning.

    Uses time-series cross-validation to properly evaluate
    prediction performance on future data.

    Args:
        X: Feature DataFrame
        y: Target Series
        n_splits: Number of CV splits

    Returns:
        Objective function for Optuna
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)

    def objective(trial: optuna.Trial) -> float:
        # Suggest hyperparameters
        params = {
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "max_depth": trial.suggest_int("max_depth", 3, 10),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 0, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.5, 2.0),
            "seed": 42,
        }

        cv_scores = []

        for train_idx, val_idx in tscv.split(X):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

            dtrain = xgb.DMatrix(X_train, label=y_train)
            dval = xgb.DMatrix(X_val, label=y_val)

            # Train with early stopping
            model = xgb.train(
                params,
                dtrain,
                num_boost_round=500,
                evals=[(dval, "eval")],
                early_stopping_rounds=30,
                verbose_eval=False,
            )

            # Evaluate
            y_prob = model.predict(dval)
            score = log_loss(y_val, y_prob)
            cv_scores.append(score)

        return np.mean(cv_scores)

    return objective


def tune_hyperparameters(
    X,
    y,
    n_trials: int = 100,
    n_splits: int = 5,
    timeout: int = None,
) -> dict:
    """
    Tune XGBoost hyperparameters using Optuna.

    Args:
        X: Feature DataFrame
        y: Target Series
        n_trials: Number of optimization trials
        n_splits: Number of CV splits
        timeout: Maximum time in seconds (optional)

    Returns:
        Best hyperparameters
    """
    # Create study
    study = optuna.create_study(
        direction="minimize",  # Minimize log loss
        sampler=TPESampler(seed=42),
        study_name="xgboost_nba_tuning",
    )

    # Create objective
    objective = create_objective(X, y, n_splits)

    # Optimize
    study.optimize(
        objective,
        n_trials=n_trials,
        timeout=timeout,
        show_progress_bar=True,
    )

    print("\n" + "=" * 60)
    print("Optimization Results")
    print("=" * 60)
    print(f"\nBest trial: {study.best_trial.number}")
    print(f"Best log loss: {study.best_value:.4f}")
    print("\nBest hyperparameters:")
    for key, value in study.best_params.items():
        print(f"  {key}: {value}")

    return study.best_params


def main():
    parser = argparse.ArgumentParser(description="Tune XGBoost hyperparameters")
    parser.add_argument(
        "--n-trials",
        type=int,
        default=100,
        help="Number of optimization trials",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=None,
        help="Maximum time in seconds",
    )
    parser.add_argument(
        "--use-sample-data",
        action="store_true",
        help="Use synthetic sample data",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="training/best_params.json",
        help="Output path for best parameters",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("XGBoost Hyperparameter Tuning with Optuna")
    print("=" * 60)

    # Load data
    print("\n1. Loading data...")
    if args.use_sample_data:
        print("   Using synthetic sample data")
        df = load_sample_data()
        loader = HistoricalDataLoader()
        df = loader._calculate_features(df)
    else:
        print("   Loading from database")
        loader = HistoricalDataLoader()
        df = loader.load_games()

    print(f"   Loaded {len(df)} games")

    # Prepare features
    feature_cols = loader.get_feature_columns()
    X = df[feature_cols].fillna(0)
    y = df["home_won"]

    # Run tuning
    print(f"\n2. Running {args.n_trials} optimization trials...")
    best_params = tune_hyperparameters(
        X, y,
        n_trials=args.n_trials,
        timeout=args.timeout,
    )

    # Save best parameters
    print(f"\n3. Saving best parameters to {args.output}...")
    import json
    from pathlib import Path

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    output = {
        "best_params": best_params,
        "tuned_at": datetime.utcnow().isoformat(),
        "n_trials": args.n_trials,
        "data_size": len(df),
    }

    with open(args.output, "w") as f:
        json.dump(output, f, indent=2)

    print("\n" + "=" * 60)
    print("Tuning complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
