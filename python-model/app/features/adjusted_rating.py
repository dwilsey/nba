"""
Adjusted Net Rating calculations with Strength of Schedule (SOS).

Formulas:
SOS_ORTG = avg(opponents' ORTG)
SOS_DRTG = avg(opponents' DRTG)
Adj_ORTG = Raw_ORTG * (League_Avg_DRTG / SOS_DRTG)
Adj_DRTG = Raw_DRTG * (League_Avg_ORTG / SOS_ORTG)
Adj_NRTG = Adj_ORTG - Adj_DRTG
"""
from typing import Optional


def calculate_adjusted_ortg(
    raw_ortg: float,
    sos_drtg: float,
    league_avg_drtg: float = 110.0,
) -> float:
    """
    Calculate SOS-adjusted offensive rating.

    A team that scores well against tough defenses gets a boost.
    A team that scores well against weak defenses gets penalized.

    Args:
        raw_ortg: Team's raw offensive rating
        sos_drtg: Strength of schedule defensive rating (opponents' average DRTG)
        league_avg_drtg: League average defensive rating

    Returns:
        Adjusted offensive rating
    """
    if sos_drtg <= 0:
        return raw_ortg

    # If opponents have better defense (lower DRTG), adjustment > 1
    # If opponents have worse defense (higher DRTG), adjustment < 1
    adjustment = league_avg_drtg / sos_drtg
    return raw_ortg * adjustment


def calculate_adjusted_drtg(
    raw_drtg: float,
    sos_ortg: float,
    league_avg_ortg: float = 110.0,
) -> float:
    """
    Calculate SOS-adjusted defensive rating.

    A team that defends well against strong offenses gets a boost.
    A team that defends well against weak offenses gets penalized.

    Args:
        raw_drtg: Team's raw defensive rating
        sos_ortg: Strength of schedule offensive rating (opponents' average ORTG)
        league_avg_ortg: League average offensive rating

    Returns:
        Adjusted defensive rating (lower is better)
    """
    if sos_ortg <= 0:
        return raw_drtg

    # If opponents have better offense (higher ORTG), adjustment < 1 (improves DRTG)
    # If opponents have worse offense (lower ORTG), adjustment > 1 (worsens DRTG)
    adjustment = sos_ortg / league_avg_ortg
    return raw_drtg / adjustment


def calculate_adjusted_ratings(
    home_ortg: float,
    home_drtg: float,
    away_ortg: float,
    away_drtg: float,
    home_sos_ortg: Optional[float] = None,
    home_sos_drtg: Optional[float] = None,
    away_sos_ortg: Optional[float] = None,
    away_sos_drtg: Optional[float] = None,
    league_avg_ortg: float = 110.0,
    league_avg_drtg: float = 110.0,
    home_adj_ortg: Optional[float] = None,
    home_adj_drtg: Optional[float] = None,
    away_adj_ortg: Optional[float] = None,
    away_adj_drtg: Optional[float] = None,
) -> dict:
    """
    Calculate all adjusted ratings for a matchup.

    If pre-computed adjusted ratings are provided, use those.
    Otherwise, calculate from raw ratings and SOS data.
    If SOS data is missing, use raw ratings.

    Args:
        home_ortg: Home team raw offensive rating
        home_drtg: Home team raw defensive rating
        away_ortg: Away team raw offensive rating
        away_drtg: Away team raw defensive rating
        home_sos_ortg: Home team SOS (opponents' avg ORTG)
        home_sos_drtg: Home team SOS (opponents' avg DRTG)
        away_sos_ortg: Away team SOS (opponents' avg ORTG)
        away_sos_drtg: Away team SOS (opponents' avg DRTG)
        league_avg_ortg: League average offensive rating
        league_avg_drtg: League average defensive rating
        home_adj_ortg: Pre-computed home adjusted ORTG
        home_adj_drtg: Pre-computed home adjusted DRTG
        away_adj_ortg: Pre-computed away adjusted ORTG
        away_adj_drtg: Pre-computed away adjusted DRTG

    Returns:
        Dictionary with adjusted ratings and differentials
    """
    # Use pre-computed adjusted ratings if available
    if home_adj_ortg is not None and home_adj_drtg is not None:
        h_adj_ortg = home_adj_ortg
        h_adj_drtg = home_adj_drtg
    # Calculate from SOS if available
    elif home_sos_ortg is not None and home_sos_drtg is not None:
        h_adj_ortg = calculate_adjusted_ortg(home_ortg, home_sos_drtg, league_avg_drtg)
        h_adj_drtg = calculate_adjusted_drtg(home_drtg, home_sos_ortg, league_avg_ortg)
    # Fall back to raw ratings
    else:
        h_adj_ortg = home_ortg
        h_adj_drtg = home_drtg

    # Same logic for away team
    if away_adj_ortg is not None and away_adj_drtg is not None:
        a_adj_ortg = away_adj_ortg
        a_adj_drtg = away_adj_drtg
    elif away_sos_ortg is not None and away_sos_drtg is not None:
        a_adj_ortg = calculate_adjusted_ortg(away_ortg, away_sos_drtg, league_avg_drtg)
        a_adj_drtg = calculate_adjusted_drtg(away_drtg, away_sos_ortg, league_avg_ortg)
    else:
        a_adj_ortg = away_ortg
        a_adj_drtg = away_drtg

    # Calculate net ratings
    h_adj_nrtg = h_adj_ortg - h_adj_drtg
    a_adj_nrtg = a_adj_ortg - a_adj_drtg

    # Add home court advantage (~3.5 points = ~3.5 net rating points)
    home_court_advantage = 3.5
    adj_nrtg_diff = (h_adj_nrtg + home_court_advantage) - a_adj_nrtg

    return {
        "home_adj_ortg": round(h_adj_ortg, 2),
        "home_adj_drtg": round(h_adj_drtg, 2),
        "home_adj_nrtg": round(h_adj_nrtg, 2),
        "away_adj_ortg": round(a_adj_ortg, 2),
        "away_adj_drtg": round(a_adj_drtg, 2),
        "away_adj_nrtg": round(a_adj_nrtg, 2),
        "adj_nrtg_diff": round(adj_nrtg_diff, 2),
        "home_court_advantage": home_court_advantage,
    }


def nrtg_to_spread(nrtg_diff: float) -> float:
    """
    Convert net rating differential to expected point spread.

    Roughly 1 point of net rating = 1 point of spread per game.

    Args:
        nrtg_diff: Adjusted net rating differential

    Returns:
        Predicted spread (negative = home favored)
    """
    # Negative spread means home is favored
    return -nrtg_diff


def nrtg_to_win_probability(nrtg_diff: float) -> float:
    """
    Convert net rating differential to win probability.

    Based on historical analysis, ~2.5-3 points of NRTG diff = 1% win probability.
    Using logistic function for smooth probability curve.

    Args:
        nrtg_diff: Adjusted net rating differential (positive = home advantage)

    Returns:
        Home team win probability (0-1)
    """
    import math

    # Logistic function with scaling factor
    # k controls steepness - roughly calibrated so 10 NRTG diff ≈ 75% win probability
    k = 0.15
    probability = 1 / (1 + math.exp(-k * nrtg_diff))

    return round(probability, 4)
