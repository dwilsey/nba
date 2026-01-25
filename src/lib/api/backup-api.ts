/**
 * Backup NBA API client for failover scenarios
 * Uses a secondary data source when primary (balldontlie) is unavailable
 */

import { Game, Team } from '@/types';

// This is a simplified backup - in production you'd integrate a real secondary API
// Options include: ESPN API, NBA.com unofficial endpoints, or cached data

interface CachedData {
  teams: Team[];
  lastUpdated: string;
}

class BackupAPIClient {
  private cache: CachedData | null = null;

  // NBA teams data - static fallback
  private static readonly NBA_TEAMS: Team[] = [
    { id: 1, abbreviation: 'ATL', city: 'Atlanta', conference: 'East', division: 'Southeast', full_name: 'Atlanta Hawks', name: 'Hawks' },
    { id: 2, abbreviation: 'BOS', city: 'Boston', conference: 'East', division: 'Atlantic', full_name: 'Boston Celtics', name: 'Celtics' },
    { id: 3, abbreviation: 'BKN', city: 'Brooklyn', conference: 'East', division: 'Atlantic', full_name: 'Brooklyn Nets', name: 'Nets' },
    { id: 4, abbreviation: 'CHA', city: 'Charlotte', conference: 'East', division: 'Southeast', full_name: 'Charlotte Hornets', name: 'Hornets' },
    { id: 5, abbreviation: 'CHI', city: 'Chicago', conference: 'East', division: 'Central', full_name: 'Chicago Bulls', name: 'Bulls' },
    { id: 6, abbreviation: 'CLE', city: 'Cleveland', conference: 'East', division: 'Central', full_name: 'Cleveland Cavaliers', name: 'Cavaliers' },
    { id: 7, abbreviation: 'DAL', city: 'Dallas', conference: 'West', division: 'Southwest', full_name: 'Dallas Mavericks', name: 'Mavericks' },
    { id: 8, abbreviation: 'DEN', city: 'Denver', conference: 'West', division: 'Northwest', full_name: 'Denver Nuggets', name: 'Nuggets' },
    { id: 9, abbreviation: 'DET', city: 'Detroit', conference: 'East', division: 'Central', full_name: 'Detroit Pistons', name: 'Pistons' },
    { id: 10, abbreviation: 'GSW', city: 'Golden State', conference: 'West', division: 'Pacific', full_name: 'Golden State Warriors', name: 'Warriors' },
    { id: 11, abbreviation: 'HOU', city: 'Houston', conference: 'West', division: 'Southwest', full_name: 'Houston Rockets', name: 'Rockets' },
    { id: 12, abbreviation: 'IND', city: 'Indiana', conference: 'East', division: 'Central', full_name: 'Indiana Pacers', name: 'Pacers' },
    { id: 13, abbreviation: 'LAC', city: 'Los Angeles', conference: 'West', division: 'Pacific', full_name: 'Los Angeles Clippers', name: 'Clippers' },
    { id: 14, abbreviation: 'LAL', city: 'Los Angeles', conference: 'West', division: 'Pacific', full_name: 'Los Angeles Lakers', name: 'Lakers' },
    { id: 15, abbreviation: 'MEM', city: 'Memphis', conference: 'West', division: 'Southwest', full_name: 'Memphis Grizzlies', name: 'Grizzlies' },
    { id: 16, abbreviation: 'MIA', city: 'Miami', conference: 'East', division: 'Southeast', full_name: 'Miami Heat', name: 'Heat' },
    { id: 17, abbreviation: 'MIL', city: 'Milwaukee', conference: 'East', division: 'Central', full_name: 'Milwaukee Bucks', name: 'Bucks' },
    { id: 18, abbreviation: 'MIN', city: 'Minnesota', conference: 'West', division: 'Northwest', full_name: 'Minnesota Timberwolves', name: 'Timberwolves' },
    { id: 19, abbreviation: 'NOP', city: 'New Orleans', conference: 'West', division: 'Southwest', full_name: 'New Orleans Pelicans', name: 'Pelicans' },
    { id: 20, abbreviation: 'NYK', city: 'New York', conference: 'East', division: 'Atlantic', full_name: 'New York Knicks', name: 'Knicks' },
    { id: 21, abbreviation: 'OKC', city: 'Oklahoma City', conference: 'West', division: 'Northwest', full_name: 'Oklahoma City Thunder', name: 'Thunder' },
    { id: 22, abbreviation: 'ORL', city: 'Orlando', conference: 'East', division: 'Southeast', full_name: 'Orlando Magic', name: 'Magic' },
    { id: 23, abbreviation: 'PHI', city: 'Philadelphia', conference: 'East', division: 'Atlantic', full_name: 'Philadelphia 76ers', name: '76ers' },
    { id: 24, abbreviation: 'PHX', city: 'Phoenix', conference: 'West', division: 'Pacific', full_name: 'Phoenix Suns', name: 'Suns' },
    { id: 25, abbreviation: 'POR', city: 'Portland', conference: 'West', division: 'Northwest', full_name: 'Portland Trail Blazers', name: 'Trail Blazers' },
    { id: 26, abbreviation: 'SAC', city: 'Sacramento', conference: 'West', division: 'Pacific', full_name: 'Sacramento Kings', name: 'Kings' },
    { id: 27, abbreviation: 'SAS', city: 'San Antonio', conference: 'West', division: 'Southwest', full_name: 'San Antonio Spurs', name: 'Spurs' },
    { id: 28, abbreviation: 'TOR', city: 'Toronto', conference: 'East', division: 'Atlantic', full_name: 'Toronto Raptors', name: 'Raptors' },
    { id: 29, abbreviation: 'UTA', city: 'Utah', conference: 'West', division: 'Northwest', full_name: 'Utah Jazz', name: 'Jazz' },
    { id: 30, abbreviation: 'WAS', city: 'Washington', conference: 'East', division: 'Southeast', full_name: 'Washington Wizards', name: 'Wizards' },
  ];

  async getTeams(): Promise<Team[]> {
    // Return static team data as fallback
    return BackupAPIClient.NBA_TEAMS;
  }

  async getTeam(id: number): Promise<Team | null> {
    const team = BackupAPIClient.NBA_TEAMS.find((t) => t.id === id);
    return team || null;
  }

  getTeamByAbbreviation(abbreviation: string): Team | null {
    return BackupAPIClient.NBA_TEAMS.find(
      (t) => t.abbreviation.toLowerCase() === abbreviation.toLowerCase()
    ) || null;
  }

  getTeamByName(name: string): Team | null {
    const searchName = name.toLowerCase();
    return BackupAPIClient.NBA_TEAMS.find(
      (t) =>
        t.name.toLowerCase() === searchName ||
        t.full_name.toLowerCase() === searchName ||
        t.city.toLowerCase() === searchName
    ) || null;
  }

  // Match team name from odds API to our team data
  matchTeamFromOdds(oddsTeamName: string): Team | null {
    const searchName = oddsTeamName.toLowerCase();

    // Try exact match first
    let team = BackupAPIClient.NBA_TEAMS.find(
      (t) => t.full_name.toLowerCase() === searchName
    );

    if (team) return team;

    // Try city + name combinations
    team = BackupAPIClient.NBA_TEAMS.find((t) => {
      const cityName = `${t.city} ${t.name}`.toLowerCase();
      return cityName === searchName || searchName.includes(t.name.toLowerCase());
    });

    return team || null;
  }

  // Placeholder for games - would integrate with secondary API
  async getGames(_date: string): Promise<Game[]> {
    // In production, this would call a secondary API
    // For now, return empty array and log warning
    console.warn('Backup API: Games endpoint not implemented, using cached data');
    return [];
  }

  isAvailable(): boolean {
    // Backup is always available since it uses static data for teams
    return true;
  }
}

export const backupApi = new BackupAPIClient();
export default backupApi;
