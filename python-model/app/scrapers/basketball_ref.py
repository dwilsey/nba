"""
Basketball Reference scraper for BPM data.

Rate limited to 20 requests per minute to respect the site's limits.
Uses exponential backoff for retries.
"""
import asyncio
import time
from typing import Optional
from dataclasses import dataclass

import httpx
from bs4 import BeautifulSoup
from ratelimit import limits, sleep_and_retry

from app.config import get_settings

settings = get_settings()

# Rate limiting: 20 requests per minute
CALLS_PER_MINUTE = settings.bbref_rate_limit
ONE_MINUTE = 60

# Request timeout
TIMEOUT = 30

# Retry settings
MAX_RETRIES = 3
BASE_DELAY = 2


@dataclass
class PlayerBPMData:
    """Player BPM data from Basketball Reference."""

    player_id: int
    player_name: str
    team_abbr: str
    season: int
    games_played: int
    minutes_played: int
    bpm: float
    obpm: float
    dbpm: float
    vorp: float


@dataclass
class TeamAdvancedStats:
    """Team advanced stats from Basketball Reference."""

    team_abbr: str
    team_name: str
    season: int

    # Ratings
    off_rating: float
    def_rating: float
    net_rating: float
    pace: float

    # Four Factors
    efg_pct: float
    tov_pct: float
    oreb_pct: float
    ftr: float
    opp_efg_pct: float
    opp_tov_pct: float
    opp_oreb_pct: float
    opp_ftr: float


class BasketballReferenceScraper:
    """Scraper for Basketball Reference advanced stats."""

    def __init__(self):
        self.base_url = settings.bbref_base_url
        self.session: Optional[httpx.AsyncClient] = None
        self.last_request_time = 0

    async def __aenter__(self):
        self.session = httpx.AsyncClient(
            timeout=TIMEOUT,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; NBAPredictor/1.0)",
            },
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.aclose()

    @sleep_and_retry
    @limits(calls=CALLS_PER_MINUTE, period=ONE_MINUTE)
    async def _rate_limited_request(self, url: str) -> str:
        """Make a rate-limited request with retries."""
        if not self.session:
            raise RuntimeError("Scraper session not initialized")

        for attempt in range(MAX_RETRIES):
            try:
                response = await self.session.get(url)
                response.raise_for_status()
                return response.text
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    # Rate limited - wait and retry
                    delay = BASE_DELAY * (2 ** attempt)
                    await asyncio.sleep(delay)
                elif e.response.status_code >= 500:
                    # Server error - retry
                    delay = BASE_DELAY * (2 ** attempt)
                    await asyncio.sleep(delay)
                else:
                    raise
            except httpx.RequestError:
                if attempt < MAX_RETRIES - 1:
                    delay = BASE_DELAY * (2 ** attempt)
                    await asyncio.sleep(delay)
                else:
                    raise

        raise RuntimeError(f"Failed to fetch {url} after {MAX_RETRIES} retries")

    async def scrape_team_bpm(self, team_abbr: str, season: int) -> list[PlayerBPMData]:
        """
        Scrape BPM data for all players on a team.

        Args:
            team_abbr: Team abbreviation (e.g., "BOS", "LAL")
            season: Season year (e.g., 2024 for 2023-24 season)

        Returns:
            List of PlayerBPMData for all players on the team
        """
        url = f"{self.base_url}/teams/{team_abbr}/{season}.html"
        html = await self._rate_limited_request(url)

        soup = BeautifulSoup(html, "lxml")
        players = []

        # Find the advanced stats table
        advanced_table = soup.find("table", {"id": "advanced"})
        if not advanced_table:
            return []

        tbody = advanced_table.find("tbody")
        if not tbody:
            return []

        for row in tbody.find_all("tr"):
            if "thead" in row.get("class", []):
                continue

            cells = row.find_all(["th", "td"])
            if len(cells) < 20:
                continue

            try:
                # Extract player link for ID
                player_link = cells[0].find("a")
                if not player_link:
                    continue

                player_href = player_link.get("href", "")
                # Extract player ID from href like /players/t/tatumja01.html
                player_id_str = player_href.split("/")[-1].replace(".html", "")

                # Get stats from cells
                player_name = cells[0].get_text(strip=True)
                games = int(cells[2].get_text(strip=True) or 0)
                minutes = int(cells[3].get_text(strip=True) or 0)

                # BPM columns are typically near the end
                # Find by data-stat attribute
                bpm_cell = row.find("td", {"data-stat": "bpm"})
                obpm_cell = row.find("td", {"data-stat": "obpm"})
                dbpm_cell = row.find("td", {"data-stat": "dbpm"})
                vorp_cell = row.find("td", {"data-stat": "vorp"})

                bpm = float(bpm_cell.get_text(strip=True) or 0) if bpm_cell else 0.0
                obpm = float(obpm_cell.get_text(strip=True) or 0) if obpm_cell else 0.0
                dbpm = float(dbpm_cell.get_text(strip=True) or 0) if dbpm_cell else 0.0
                vorp = float(vorp_cell.get_text(strip=True) or 0) if vorp_cell else 0.0

                players.append(
                    PlayerBPMData(
                        player_id=hash(player_id_str),  # Use hash of string ID
                        player_name=player_name,
                        team_abbr=team_abbr,
                        season=season,
                        games_played=games,
                        minutes_played=minutes,
                        bpm=bpm,
                        obpm=obpm,
                        dbpm=dbpm,
                        vorp=vorp,
                    )
                )
            except (ValueError, AttributeError):
                continue

        return players

    async def scrape_team_advanced_stats(self, team_abbr: str, season: int) -> Optional[TeamAdvancedStats]:
        """
        Scrape team advanced stats including Four Factors.

        Args:
            team_abbr: Team abbreviation
            season: Season year

        Returns:
            TeamAdvancedStats or None if not found
        """
        url = f"{self.base_url}/teams/{team_abbr}/{season}.html"
        html = await self._rate_limited_request(url)

        soup = BeautifulSoup(html, "lxml")

        # Find team stats in the team-stats div
        team_stats_div = soup.find("div", {"id": "all_team_misc"})
        if not team_stats_div:
            return None

        # Parse the comment containing the table
        comment = team_stats_div.find(string=lambda text: isinstance(text, str) and "team_misc" in text)
        if comment:
            comment_soup = BeautifulSoup(comment, "lxml")
            table = comment_soup.find("table", {"id": "team_misc"})
        else:
            table = team_stats_div.find("table")

        if not table:
            return None

        try:
            # Extract values using data-stat attributes
            def get_stat(stat_name: str, default: float = 0.0) -> float:
                cell = table.find("td", {"data-stat": stat_name})
                if cell:
                    try:
                        return float(cell.get_text(strip=True) or default)
                    except ValueError:
                        return default
                return default

            return TeamAdvancedStats(
                team_abbr=team_abbr,
                team_name=soup.find("h1").get_text(strip=True) if soup.find("h1") else team_abbr,
                season=season,
                off_rating=get_stat("off_rtg"),
                def_rating=get_stat("def_rtg"),
                net_rating=get_stat("net_rtg"),
                pace=get_stat("pace"),
                efg_pct=get_stat("efg_pct"),
                tov_pct=get_stat("tov_pct"),
                oreb_pct=get_stat("orb_pct"),
                ftr=get_stat("ft_rate"),
                opp_efg_pct=get_stat("opp_efg_pct"),
                opp_tov_pct=get_stat("opp_tov_pct"),
                opp_oreb_pct=get_stat("opp_orb_pct"),
                opp_ftr=get_stat("opp_ft_rate"),
            )
        except (ValueError, AttributeError):
            return None

    async def scrape_league_averages(self, season: int) -> dict:
        """
        Scrape league average stats for a season.

        Args:
            season: Season year

        Returns:
            Dictionary with league average stats
        """
        url = f"{self.base_url}/leagues/NBA_{season}.html"
        html = await self._rate_limited_request(url)

        soup = BeautifulSoup(html, "lxml")

        # Default values if scraping fails
        defaults = {
            "avg_ortg": 110.0,
            "avg_drtg": 110.0,
            "avg_pace": 100.0,
        }

        try:
            # Find league stats table
            misc_table = soup.find("table", {"id": "misc_stats"})
            if not misc_table:
                return defaults

            # League average is typically in the last row or in a summary
            tfoot = misc_table.find("tfoot")
            if tfoot:
                row = tfoot.find("tr")
                if row:
                    ortg_cell = row.find("td", {"data-stat": "off_rtg"})
                    drtg_cell = row.find("td", {"data-stat": "def_rtg"})
                    pace_cell = row.find("td", {"data-stat": "pace"})

                    return {
                        "avg_ortg": float(ortg_cell.get_text(strip=True)) if ortg_cell else 110.0,
                        "avg_drtg": float(drtg_cell.get_text(strip=True)) if drtg_cell else 110.0,
                        "avg_pace": float(pace_cell.get_text(strip=True)) if pace_cell else 100.0,
                    }
        except (ValueError, AttributeError):
            pass

        return defaults

    async def scrape_all_teams_bpm(self, season: int) -> dict[str, list[PlayerBPMData]]:
        """
        Scrape BPM data for all 30 NBA teams.

        Args:
            season: Season year

        Returns:
            Dictionary mapping team abbreviation to list of player BPM data
        """
        teams = [
            "ATL", "BOS", "BRK", "CHO", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
            "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
            "OKC", "ORL", "PHI", "PHO", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
        ]

        results = {}
        for team in teams:
            try:
                players = await self.scrape_team_bpm(team, season)
                results[team] = players
            except Exception as e:
                print(f"Error scraping {team}: {e}")
                results[team] = []

        return results


# Convenience function for synchronous usage
def scrape_team_bpm_sync(team_abbr: str, season: int) -> list[PlayerBPMData]:
    """Synchronous wrapper for scraping team BPM data."""
    async def _run():
        async with BasketballReferenceScraper() as scraper:
            return await scraper.scrape_team_bpm(team_abbr, season)

    return asyncio.run(_run())


def scrape_team_stats_sync(team_abbr: str, season: int) -> Optional[TeamAdvancedStats]:
    """Synchronous wrapper for scraping team advanced stats."""
    async def _run():
        async with BasketballReferenceScraper() as scraper:
            return await scraper.scrape_team_advanced_stats(team_abbr, season)

    return asyncio.run(_run())
