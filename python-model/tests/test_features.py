"""
Tests for feature engineering modules.
"""
import pytest
from app.features.adjusted_rating import (
    calculate_adjusted_ortg,
    calculate_adjusted_drtg,
    calculate_adjusted_ratings,
    nrtg_to_win_probability,
)
from app.features.four_factors import (
    calculate_efg,
    calculate_tov_pct,
    calculate_four_factors_differential,
)
from app.features.pace_metrics import (
    calculate_possessions,
    calculate_pace,
    project_game_pace,
    calculate_pace_metrics,
)
from app.features.player_impact import (
    calculate_team_bpm,
    calculate_top_n_bpm,
    calculate_bpm_differential,
)
from app.features.line_movement import (
    calculate_spread_movement,
    calculate_line_movement_features,
    classify_line_movement,
)


class TestAdjustedRatings:
    def test_adjusted_ortg_tough_schedule(self):
        """Team with tough schedule (low SOS DRTG) should get boost."""
        raw_ortg = 110.0
        sos_drtg = 105.0  # Faced tough defenses
        league_avg = 110.0

        adj_ortg = calculate_adjusted_ortg(raw_ortg, sos_drtg, league_avg)
        assert adj_ortg > raw_ortg  # Should be boosted

    def test_adjusted_ortg_easy_schedule(self):
        """Team with easy schedule (high SOS DRTG) should be penalized."""
        raw_ortg = 110.0
        sos_drtg = 115.0  # Faced weak defenses
        league_avg = 110.0

        adj_ortg = calculate_adjusted_ortg(raw_ortg, sos_drtg, league_avg)
        assert adj_ortg < raw_ortg  # Should be penalized

    def test_adjusted_ratings_home_advantage(self):
        """Home team should get ~3.5 point advantage."""
        result = calculate_adjusted_ratings(
            home_ortg=110.0,
            home_drtg=110.0,
            away_ortg=110.0,
            away_drtg=110.0,
        )

        # With equal ratings, home advantage should be ~3.5
        assert abs(result["adj_nrtg_diff"] - 3.5) < 0.1

    def test_nrtg_to_probability(self):
        """Test probability conversion."""
        # Equal teams + home court = ~60% for home
        prob = nrtg_to_win_probability(3.5)
        assert 0.55 < prob < 0.65

        # Large advantage = high probability
        prob_big = nrtg_to_win_probability(15.0)
        assert prob_big > 0.85

        # Big disadvantage = low probability
        prob_low = nrtg_to_win_probability(-15.0)
        assert prob_low < 0.15


class TestFourFactors:
    def test_efg_calculation(self):
        """Test effective FG% calculation."""
        # 40 FGM, 5 3PM, 80 FGA
        # eFG% = (40 + 0.5*5) / 80 = 42.5 / 80 = 0.53125
        efg = calculate_efg(fgm=40, fg3m=5, fga=80)
        assert abs(efg - 0.53125) < 0.0001

    def test_tov_pct_calculation(self):
        """Test turnover % calculation."""
        # 15 TOV, 80 FGA, 20 FTA
        # Possessions = 80 + 0.44*20 + 15 = 103.8
        # TOV% = 15 / 103.8 ≈ 0.1445
        tov_pct = calculate_tov_pct(tov=15, fga=80, fta=20)
        assert 0.14 < tov_pct < 0.15

    def test_four_factors_differential(self):
        """Test four factors differential calculation."""
        result = calculate_four_factors_differential(
            home_efg=0.55, home_tov=0.12, home_oreb=0.28, home_ftr=0.28,
            home_opp_efg=0.50, home_opp_tov=0.15, home_opp_oreb=0.24, home_opp_ftr=0.22,
            away_efg=0.50, away_tov=0.15, away_oreb=0.24, away_ftr=0.22,
            away_opp_efg=0.55, away_opp_tov=0.12, away_opp_oreb=0.28, away_opp_ftr=0.28,
        )

        # Home team is better in all factors
        assert result["efg_diff"] > 0
        assert result["tov_diff"] > 0  # Away has more turnovers = good for home
        assert result["composite"] > 0


class TestPaceMetrics:
    def test_possessions_calculation(self):
        """Test possessions formula."""
        # 80 FGA, 10 OREB, 15 TOV, 20 FTA
        # Poss = 80 - 10 + 15 + 0.44*20 = 93.8
        poss = calculate_possessions(fga=80, oreb=10, tov=15, fta=20)
        assert abs(poss - 93.8) < 0.1

    def test_pace_calculation(self):
        """Test pace calculation."""
        # 93.8 possessions in 48 minutes = pace of 93.8
        pace = calculate_pace(possessions=93.8, minutes=48.0)
        assert abs(pace - 93.8) < 0.1

    def test_game_pace_projection(self):
        """Test projected game pace."""
        # Fast team (105) vs slow team (95) = ~100 average
        projected = project_game_pace(home_pace=105, away_pace=95, league_avg_pace=100)
        assert 99 < projected < 101

    def test_pace_metrics(self):
        """Test full pace metrics calculation."""
        result = calculate_pace_metrics(home_pace=102, away_pace=98)
        assert result["pace_diff"] == 4.0
        assert 99 < result["projected_pace"] < 101


class TestPlayerImpact:
    def test_team_bpm_calculation(self):
        """Test weighted team BPM."""
        players = [
            {"bpm": 5.0, "minutes": 1000},  # Star player
            {"bpm": 2.0, "minutes": 800},   # Starter
            {"bpm": -1.0, "minutes": 500},  # Bench
        ]
        team_bpm = calculate_team_bpm(players)
        # Weighted toward star player
        assert team_bpm > 2.0

    def test_top_n_bpm(self):
        """Test top N players BPM."""
        players = [
            {"bpm": 8.0},
            {"bpm": 5.0},
            {"bpm": 3.0},
            {"bpm": 1.0},
            {"bpm": -1.0},
            {"bpm": -3.0},
        ]
        top_5 = calculate_top_n_bpm(players, n=5)
        # Average of top 5: (8+5+3+1-1)/5 = 3.2
        assert abs(top_5 - 3.2) < 0.1

    def test_bpm_differential(self):
        """Test BPM differential calculation."""
        result = calculate_bpm_differential(
            home_bpm=2.5,
            away_bpm=0.5,
            home_top_5_bpm=5.0,
            away_top_5_bpm=3.0,
        )
        assert result["bpm_diff"] == 2.0
        assert result["top_5_bpm_diff"] == 2.0


class TestLineMovement:
    def test_spread_movement(self):
        """Test spread movement calculation."""
        # Opened at -3, closed at -5 = 2 points toward home
        movement = calculate_spread_movement(opening_spread=-3.0, closing_spread=-5.0)
        assert movement == -2.0  # Negative = moved toward home

    def test_movement_classification(self):
        """Test line movement classification."""
        assert classify_line_movement(-1.5) == "sharp_home"
        assert classify_line_movement(1.5) == "sharp_away"
        assert classify_line_movement(0.5) == "stable"

    def test_line_movement_features(self):
        """Test full line movement features."""
        result = calculate_line_movement_features(
            opening_spread=-3.0,
            current_spread=-4.5,
        )
        assert result["spread_movement"] == -1.5
        assert result["spread_direction"] == "sharp_home"
        assert result["implied_prob_shift"] > 0  # Home more likely


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
