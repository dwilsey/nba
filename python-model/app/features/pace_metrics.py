"""
Pace metrics calculations.

Pace = Possessions per 48 minutes
Points per 100 = (Points / Possessions) * 100

Possessions formula:
Possessions = FGA - OREB + TOV + 0.44 * FTA

Game pace projection uses the average of both teams' pace,
adjusted for the expected defensive impact.
"""


def calculate_possessions(fga: int, oreb: int, tov: int, fta: int) -> float:
    """
    Calculate number of possessions.

    Possessions = FGA - OREB + TOV + 0.44 * FTA

    The 0.44 factor accounts for and-ones, technical free throws,
    and three-shot fouls which don't end possessions.

    Args:
        fga: Field goal attempts
        oreb: Offensive rebounds
        tov: Turnovers
        fta: Free throw attempts

    Returns:
        Estimated possessions
    """
    return fga - oreb + tov + 0.44 * fta


def calculate_pace(possessions: float, minutes: float = 48.0) -> float:
    """
    Calculate pace (possessions per 48 minutes).

    Args:
        possessions: Total possessions in game
        minutes: Game duration (default 48)

    Returns:
        Pace value
    """
    if minutes == 0:
        return 0.0
    return (possessions / minutes) * 48.0


def calculate_points_per_100(points: int, possessions: float) -> float:
    """
    Calculate points per 100 possessions.

    This is the offensive/defensive rating.

    Args:
        points: Total points scored
        possessions: Total possessions

    Returns:
        Points per 100 possessions
    """
    if possessions == 0:
        return 0.0
    return (points / possessions) * 100


def project_game_pace(home_pace: float, away_pace: float, league_avg_pace: float = 100.0) -> float:
    """
    Project the expected pace for a game.

    Uses a weighted average that regresses slightly toward league average,
    as extreme pace teams tend to normalize when playing each other.

    Args:
        home_pace: Home team's season pace
        away_pace: Away team's season pace
        league_avg_pace: League average pace

    Returns:
        Projected game pace
    """
    # Simple average of both teams
    team_avg = (home_pace + away_pace) / 2

    # Regress 10% toward league average
    regression_factor = 0.10
    projected = team_avg * (1 - regression_factor) + league_avg_pace * regression_factor

    return round(projected, 1)


def project_game_total(
    home_ortg: float,
    home_drtg: float,
    away_ortg: float,
    away_drtg: float,
    projected_pace: float,
) -> float:
    """
    Project the total points for a game.

    Uses the projected pace and each team's expected offensive output
    against the opponent's defense.

    Args:
        home_ortg: Home team offensive rating
        home_drtg: Home team defensive rating
        away_ortg: Away team offensive rating
        away_drtg: Away team defensive rating
        projected_pace: Expected game pace

    Returns:
        Projected total points
    """
    # Home team's expected points = f(home offense, away defense)
    # Average the offensive rating against the defensive rating
    home_expected_ortg = (home_ortg + away_drtg) / 2
    away_expected_ortg = (away_ortg + home_drtg) / 2

    # Convert to actual points using pace
    # Points = (ORTG / 100) * possessions
    # Since pace is possessions per 48 min, and NBA games are 48 min
    home_points = (home_expected_ortg / 100) * projected_pace
    away_points = (away_expected_ortg / 100) * projected_pace

    # Add small home court scoring advantage (~1.5 points)
    home_points += 1.5

    return round(home_points + away_points, 1)


def calculate_pace_metrics(home_pace: float, away_pace: float, league_avg_pace: float = 100.0) -> dict:
    """
    Calculate all pace-related metrics for a matchup.

    Args:
        home_pace: Home team's season pace
        away_pace: Away team's season pace
        league_avg_pace: League average pace

    Returns:
        Dictionary with pace metrics
    """
    pace_diff = home_pace - away_pace
    projected = project_game_pace(home_pace, away_pace, league_avg_pace)

    # Pace differential from league average (positive = fast game expected)
    pace_vs_league = projected - league_avg_pace

    return {
        "home_pace": round(home_pace, 1),
        "away_pace": round(away_pace, 1),
        "pace_diff": round(pace_diff, 1),
        "projected_pace": projected,
        "pace_vs_league": round(pace_vs_league, 1),
    }


def pace_adjustment_factor(game_pace: float, league_avg_pace: float = 100.0) -> float:
    """
    Calculate an adjustment factor for predictions based on pace.

    High-pace games have more variance, while low-pace games are
    more predictable. This factor can be used to adjust confidence.

    Args:
        game_pace: Projected game pace
        league_avg_pace: League average pace

    Returns:
        Adjustment factor (1.0 = neutral, <1.0 = less confident, >1.0 = more confident)
    """
    # Calculate how far from league average
    pace_deviation = abs(game_pace - league_avg_pace) / league_avg_pace

    # Higher deviation = lower confidence
    # Max adjustment of 10% either way
    adjustment = 1.0 - (pace_deviation * 0.5)

    return max(0.9, min(1.1, adjustment))
