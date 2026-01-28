"""
Player Impact metrics using Box Plus/Minus (BPM).

BPM estimates a player's contribution to the team per 100 possessions.
- League average = 0.0
- All-Star level = +4.0 to +6.0
- MVP level = +8.0 to +10.0

Components:
- OBPM: Offensive Box Plus/Minus
- DBPM: Defensive Box Plus/Minus
- BPM = OBPM + DBPM
- VORP: Value Over Replacement Player (BPM scaled by minutes)
"""
from typing import Optional


def calculate_team_bpm(player_bpms: list[dict]) -> float:
    """
    Calculate team-aggregate BPM weighted by minutes played.

    Args:
        player_bpms: List of dicts with 'bpm' and 'minutes' keys

    Returns:
        Weighted team BPM
    """
    if not player_bpms:
        return 0.0

    total_minutes = sum(p.get("minutes", 0) for p in player_bpms)
    if total_minutes == 0:
        return 0.0

    weighted_bpm = sum(
        p.get("bpm", 0) * p.get("minutes", 0)
        for p in player_bpms
    )

    return weighted_bpm / total_minutes


def calculate_top_n_bpm(player_bpms: list[dict], n: int = 5) -> float:
    """
    Calculate average BPM of top N players by BPM.

    This captures the impact of star players, which is often
    more predictive than full team BPM.

    Args:
        player_bpms: List of dicts with 'bpm' key
        n: Number of top players to average

    Returns:
        Average BPM of top N players
    """
    if not player_bpms:
        return 0.0

    sorted_players = sorted(player_bpms, key=lambda p: p.get("bpm", 0), reverse=True)
    top_n = sorted_players[:n]

    if not top_n:
        return 0.0

    return sum(p.get("bpm", 0) for p in top_n) / len(top_n)


def calculate_injury_adjusted_bpm(
    player_bpms: list[dict],
    injured_player_ids: list[int],
    replacement_bpm: float = -2.0,
) -> float:
    """
    Calculate team BPM adjusted for injured players.

    Replaces injured players' BPM with replacement-level BPM,
    accounting for the minutes they would have played.

    Args:
        player_bpms: List of player BPM data
        injured_player_ids: IDs of injured players
        replacement_bpm: BPM of replacement-level player (default -2.0)

    Returns:
        Injury-adjusted team BPM
    """
    if not player_bpms:
        return 0.0

    total_minutes = 0
    weighted_bpm = 0

    for player in player_bpms:
        minutes = player.get("minutes", 0)
        total_minutes += minutes

        if player.get("player_id") in injured_player_ids:
            # Use replacement-level BPM for injured players
            weighted_bpm += replacement_bpm * minutes
        else:
            weighted_bpm += player.get("bpm", 0) * minutes

    if total_minutes == 0:
        return 0.0

    return weighted_bpm / total_minutes


def calculate_bpm_differential(
    home_bpm: Optional[float],
    away_bpm: Optional[float],
    home_top_5_bpm: Optional[float] = None,
    away_top_5_bpm: Optional[float] = None,
) -> dict:
    """
    Calculate BPM differentials for a matchup.

    Args:
        home_bpm: Home team aggregate BPM
        away_bpm: Away team aggregate BPM
        home_top_5_bpm: Home team top 5 players BPM
        away_top_5_bpm: Away team top 5 players BPM

    Returns:
        Dictionary with BPM differentials
    """
    # Handle missing data
    h_bpm = home_bpm if home_bpm is not None else 0.0
    a_bpm = away_bpm if away_bpm is not None else 0.0

    bpm_diff = h_bpm - a_bpm

    # Top 5 BPM differential
    if home_top_5_bpm is not None and away_top_5_bpm is not None:
        top_5_diff = home_top_5_bpm - away_top_5_bpm
    else:
        top_5_diff = 0.0

    return {
        "home_bpm": round(h_bpm, 2),
        "away_bpm": round(a_bpm, 2),
        "bpm_diff": round(bpm_diff, 2),
        "home_top_5_bpm": round(home_top_5_bpm, 2) if home_top_5_bpm else None,
        "away_top_5_bpm": round(away_top_5_bpm, 2) if away_top_5_bpm else None,
        "top_5_bpm_diff": round(top_5_diff, 2),
    }


def estimate_win_impact(bpm_diff: float) -> float:
    """
    Estimate the win probability impact from BPM differential.

    Based on historical analysis, roughly 1 point of team BPM difference
    translates to ~2-3% win probability difference.

    Args:
        bpm_diff: BPM differential (positive = home advantage)

    Returns:
        Estimated win probability adjustment (0-1 scale addition)
    """
    # ~2.5% per point of BPM
    return bpm_diff * 0.025


def calculate_vorp(bpm: float, minutes_played: int, team_games: int = 82) -> float:
    """
    Calculate Value Over Replacement Player.

    VORP = (BPM - (-2.0)) * (% of team minutes) * team games

    Args:
        bpm: Player's Box Plus/Minus
        minutes_played: Player's minutes played
        team_games: Number of team games (default 82)

    Returns:
        VORP value
    """
    # Replacement level BPM is -2.0
    replacement_bpm = -2.0

    # Team minutes per game = 48 * 5 = 240
    team_minutes_per_game = 240

    # Total team minutes in season
    total_team_minutes = team_minutes_per_game * team_games

    # Percentage of team minutes
    minutes_pct = minutes_played / total_team_minutes if total_team_minutes > 0 else 0

    return (bpm - replacement_bpm) * minutes_pct * team_games
