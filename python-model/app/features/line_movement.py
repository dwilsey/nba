"""
Line movement tracking and analysis.

Tracks changes in betting lines from open to close to identify
sharp money and market sentiment shifts.

Key metrics:
- Spread movement: Change from opening to closing spread
- Total movement: Change from opening to closing total
- Reverse line movement: When line moves against public betting %
"""
from typing import Optional


def calculate_spread_movement(
    opening_spread: Optional[float],
    closing_spread: Optional[float],
) -> float:
    """
    Calculate spread movement from open to close.

    Positive movement = line moved toward home team (less favorable for home)
    Negative movement = line moved toward away team (more favorable for home)

    Args:
        opening_spread: Opening spread (negative = home favored)
        closing_spread: Closing/current spread

    Returns:
        Spread movement (closing - opening)
    """
    if opening_spread is None or closing_spread is None:
        return 0.0

    return closing_spread - opening_spread


def calculate_total_movement(
    opening_total: Optional[float],
    closing_total: Optional[float],
) -> float:
    """
    Calculate total (over/under) movement from open to close.

    Positive movement = total increased (more expected scoring)
    Negative movement = total decreased (less expected scoring)

    Args:
        opening_total: Opening total line
        closing_total: Closing/current total line

    Returns:
        Total movement (closing - opening)
    """
    if opening_total is None or closing_total is None:
        return 0.0

    return closing_total - opening_total


def classify_line_movement(movement: float, threshold: float = 1.0) -> str:
    """
    Classify the significance of line movement.

    Args:
        movement: Amount of line movement
        threshold: Significant movement threshold (default 1 point)

    Returns:
        Classification: "sharp_home", "sharp_away", or "stable"
    """
    if movement <= -threshold:
        return "sharp_home"  # Line moved toward home = sharp money on home
    elif movement >= threshold:
        return "sharp_away"  # Line moved toward away = sharp money on away
    else:
        return "stable"


def calculate_implied_probability_shift(
    opening_spread: Optional[float],
    closing_spread: Optional[float],
) -> float:
    """
    Estimate the implied probability shift from line movement.

    Rule of thumb: 1 point of spread ≈ 3% win probability

    Args:
        opening_spread: Opening spread
        closing_spread: Closing spread

    Returns:
        Implied probability shift (positive = home more likely to win)
    """
    movement = calculate_spread_movement(opening_spread, closing_spread)

    # 1 point = ~3% probability
    # Negative movement (line moving toward home) = home more favored
    return -movement * 0.03


def calculate_line_movement_features(
    opening_spread: Optional[float],
    current_spread: Optional[float],
    opening_total: Optional[float] = None,
    current_total: Optional[float] = None,
) -> dict:
    """
    Calculate all line movement features for prediction.

    Args:
        opening_spread: Opening spread
        current_spread: Current/closing spread
        opening_total: Opening total
        current_total: Current/closing total

    Returns:
        Dictionary with line movement features
    """
    spread_movement = calculate_spread_movement(opening_spread, current_spread)
    total_movement = calculate_total_movement(opening_total, current_total)

    return {
        "opening_spread": opening_spread if opening_spread is not None else 0.0,
        "current_spread": current_spread if current_spread is not None else 0.0,
        "spread_movement": round(spread_movement, 2),
        "spread_direction": classify_line_movement(spread_movement),
        "opening_total": opening_total if opening_total is not None else 0.0,
        "current_total": current_total if current_total is not None else 0.0,
        "total_movement": round(total_movement, 2),
        "implied_prob_shift": round(
            calculate_implied_probability_shift(opening_spread, current_spread), 4
        ),
    }


def is_reverse_line_movement(
    spread_movement: float,
    public_home_pct: float,
    threshold: float = 0.5,
) -> bool:
    """
    Detect reverse line movement (sharp money indicator).

    Reverse line movement occurs when the line moves opposite to
    where the majority of public bets are being placed.

    Args:
        spread_movement: Change in spread (positive = moved toward away)
        public_home_pct: Percentage of public bets on home team (0-1)
        threshold: Minimum public % to consider (default 50%)

    Returns:
        True if reverse line movement detected
    """
    # If public is on home (>threshold) but line moved toward home (negative movement)
    # = sharp money on home, public getting better number
    if public_home_pct > threshold and spread_movement < -0.5:
        return True

    # If public is on away (<1-threshold) but line moved toward away (positive movement)
    # = sharp money on away
    if public_home_pct < (1 - threshold) and spread_movement > 0.5:
        return True

    return False


def steam_move_detected(
    movements: list[dict],
    threshold_points: float = 1.5,
    threshold_minutes: int = 30,
) -> bool:
    """
    Detect steam moves (rapid, coordinated line movements).

    Steam moves indicate sharp betting syndicates placing large
    bets simultaneously across multiple books.

    Args:
        movements: List of line movement records with 'spread', 'timestamp'
        threshold_points: Minimum movement to qualify (default 1.5 points)
        threshold_minutes: Time window for movement (default 30 minutes)

    Returns:
        True if steam move pattern detected
    """
    if len(movements) < 2:
        return False

    # Sort by timestamp
    sorted_movements = sorted(movements, key=lambda x: x.get("timestamp", 0))

    # Look for rapid movements
    for i in range(1, len(sorted_movements)):
        prev = sorted_movements[i - 1]
        curr = sorted_movements[i]

        time_diff = (curr.get("timestamp", 0) - prev.get("timestamp", 0)) / 60  # minutes
        spread_diff = abs(curr.get("spread", 0) - prev.get("spread", 0))

        if time_diff <= threshold_minutes and spread_diff >= threshold_points:
            return True

    return False
