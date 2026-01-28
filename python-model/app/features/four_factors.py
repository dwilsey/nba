"""
Dean Oliver's Four Factors calculations.

The Four Factors that determine basketball success:
1. Effective Field Goal % (eFG%) - Shooting efficiency, weighted for 3-pointers
2. Turnover % (TOV%) - Ball security
3. Offensive Rebound % (OREB%) - Second chance opportunities
4. Free Throw Rate (FTR) - Getting to the line

Weights (from Dean Oliver's research):
- eFG%: 40%
- TOV%: 25%
- OREB%: 20%
- FTR: 15%

Formulas:
eFG% = (FGM + 0.5 * 3PM) / FGA
TOV% = TOV / (FGA + 0.44 * FTA + TOV)
OREB% = OREB / (OREB + Opp_DREB)
FTR = FTM / FGA
"""
from app.config import get_settings

settings = get_settings()


def calculate_efg(fgm: int, fg3m: int, fga: int) -> float:
    """
    Calculate Effective Field Goal Percentage.

    eFG% = (FGM + 0.5 * 3PM) / FGA

    Args:
        fgm: Field goals made
        fg3m: Three-point field goals made
        fga: Field goal attempts

    Returns:
        Effective FG% as decimal (0-1)
    """
    if fga == 0:
        return 0.0
    return (fgm + 0.5 * fg3m) / fga


def calculate_tov_pct(tov: int, fga: int, fta: int) -> float:
    """
    Calculate Turnover Percentage.

    TOV% = TOV / (FGA + 0.44 * FTA + TOV)

    The 0.44 factor accounts for free throws that end possessions.

    Args:
        tov: Turnovers
        fga: Field goal attempts
        fta: Free throw attempts

    Returns:
        Turnover % as decimal (0-1)
    """
    possessions = fga + 0.44 * fta + tov
    if possessions == 0:
        return 0.0
    return tov / possessions


def calculate_oreb_pct(oreb: int, opp_dreb: int) -> float:
    """
    Calculate Offensive Rebound Percentage.

    OREB% = OREB / (OREB + Opp_DREB)

    Args:
        oreb: Offensive rebounds
        opp_dreb: Opponent defensive rebounds

    Returns:
        Offensive rebound % as decimal (0-1)
    """
    total = oreb + opp_dreb
    if total == 0:
        return 0.0
    return oreb / total


def calculate_ftr(ftm: int, fga: int) -> float:
    """
    Calculate Free Throw Rate.

    FTR = FTM / FGA

    Note: Some definitions use FTA/FGA, but FTM/FGA better reflects
    actual points generated from free throws.

    Args:
        ftm: Free throws made
        fga: Field goal attempts

    Returns:
        Free throw rate as decimal
    """
    if fga == 0:
        return 0.0
    return ftm / fga


def calculate_four_factors_composite(
    efg: float,
    tov: float,
    oreb: float,
    ftr: float,
    opp_efg: float,
    opp_tov: float,
    opp_oreb: float,
    opp_ftr: float,
) -> float:
    """
    Calculate weighted composite Four Factors score.

    Combines offensive and defensive Four Factors into a single metric.
    Positive score = team is better, negative = team is worse.

    Args:
        efg: Team's effective FG%
        tov: Team's turnover %
        oreb: Team's offensive rebound %
        ftr: Team's free throw rate
        opp_efg: Opponent's effective FG% (team's defensive eFG%)
        opp_tov: Opponent's turnover % (team's forced turnovers)
        opp_oreb: Opponent's offensive rebound % (team's DREB%)
        opp_ftr: Opponent's free throw rate

    Returns:
        Composite score (positive = better)
    """
    # Weights from Dean Oliver's research
    efg_weight = settings.efg_weight  # 0.40
    tov_weight = settings.tov_weight  # 0.25
    oreb_weight = settings.oreb_weight  # 0.20
    ftr_weight = settings.ftr_weight  # 0.15

    # Offensive factors (higher is better, except TOV)
    off_score = (
        efg_weight * efg
        - tov_weight * tov  # Lower TOV is better
        + oreb_weight * oreb
        + ftr_weight * ftr
    )

    # Defensive factors (inverse - lower opponent values are better)
    def_score = (
        efg_weight * (1 - opp_efg)  # Lower opponent eFG is better
        + tov_weight * opp_tov  # Higher opponent TOV is better (we force turnovers)
        + oreb_weight * (1 - opp_oreb)  # Lower opponent OREB is better
        + ftr_weight * (1 - opp_ftr)  # Lower opponent FTR is better
    )

    return off_score + def_score


def calculate_four_factors_differential(
    home_efg: float,
    home_tov: float,
    home_oreb: float,
    home_ftr: float,
    home_opp_efg: float,
    home_opp_tov: float,
    home_opp_oreb: float,
    home_opp_ftr: float,
    away_efg: float,
    away_tov: float,
    away_oreb: float,
    away_ftr: float,
    away_opp_efg: float,
    away_opp_tov: float,
    away_opp_oreb: float,
    away_opp_ftr: float,
) -> dict:
    """
    Calculate Four Factors differentials between home and away teams.

    Returns individual factor differentials and a composite score.
    Positive values favor the home team.

    Args:
        home_*: Home team's Four Factors
        away_*: Away team's Four Factors

    Returns:
        Dictionary with differentials for each factor and composite
    """
    # Offensive differentials (home - away)
    efg_diff = home_efg - away_efg
    tov_diff = away_tov - home_tov  # Inverted: lower TOV is better
    oreb_diff = home_oreb - away_oreb
    ftr_diff = home_ftr - away_ftr

    # Defensive differentials (home defense vs away defense)
    # Lower opponent stats = better defense
    def_efg_diff = away_opp_efg - home_opp_efg  # Home allows less eFG = positive
    def_tov_diff = home_opp_tov - away_opp_tov  # Home forces more TOV = positive
    def_oreb_diff = away_opp_oreb - home_opp_oreb  # Home allows less OREB = positive
    def_ftr_diff = away_opp_ftr - home_opp_ftr  # Home allows less FTR = positive

    # Calculate composite scores for each team
    home_composite = calculate_four_factors_composite(
        home_efg, home_tov, home_oreb, home_ftr,
        home_opp_efg, home_opp_tov, home_opp_oreb, home_opp_ftr,
    )
    away_composite = calculate_four_factors_composite(
        away_efg, away_tov, away_oreb, away_ftr,
        away_opp_efg, away_opp_tov, away_opp_oreb, away_opp_ftr,
    )

    return {
        # Offensive factor differentials
        "efg_diff": round(efg_diff, 4),
        "tov_diff": round(tov_diff, 4),
        "oreb_diff": round(oreb_diff, 4),
        "ftr_diff": round(ftr_diff, 4),
        # Defensive factor differentials
        "def_efg_diff": round(def_efg_diff, 4),
        "def_tov_diff": round(def_tov_diff, 4),
        "def_oreb_diff": round(def_oreb_diff, 4),
        "def_ftr_diff": round(def_ftr_diff, 4),
        # Composite scores
        "home_composite": round(home_composite, 4),
        "away_composite": round(away_composite, 4),
        "composite": round(home_composite - away_composite, 4),
    }
