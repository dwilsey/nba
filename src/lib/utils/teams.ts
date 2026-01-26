/**
 * NBA Team Utilities
 *
 * The balldontlie API returns all historical teams including defunct franchises.
 * This module provides utilities to filter to only current NBA teams.
 */

// Current 30 NBA team IDs from balldontlie API (teams 1-30)
// These are the active franchises as of the 2024-25 season
export const CURRENT_NBA_TEAM_IDS = [
  1,  // Atlanta Hawks
  2,  // Boston Celtics
  3,  // Brooklyn Nets
  4,  // Charlotte Hornets
  5,  // Chicago Bulls
  6,  // Cleveland Cavaliers
  7,  // Dallas Mavericks
  8,  // Denver Nuggets
  9,  // Detroit Pistons
  10, // Golden State Warriors
  11, // Houston Rockets
  12, // Indiana Pacers
  13, // Los Angeles Clippers
  14, // Los Angeles Lakers
  15, // Memphis Grizzlies
  16, // Miami Heat
  17, // Milwaukee Bucks
  18, // Minnesota Timberwolves
  19, // New Orleans Pelicans
  20, // New York Knicks
  21, // Oklahoma City Thunder
  22, // Orlando Magic
  23, // Philadelphia 76ers
  24, // Phoenix Suns
  25, // Portland Trail Blazers
  26, // Sacramento Kings
  27, // San Antonio Spurs
  28, // Toronto Raptors
  29, // Utah Jazz
  30, // Washington Wizards
];

/**
 * Check if a team ID represents a current NBA team
 * @param teamId - The team ID to check
 * @returns true if the team is a current NBA franchise
 */
export function isCurrentNBATeam(teamId: number): boolean {
  return CURRENT_NBA_TEAM_IDS.includes(teamId);
}

/**
 * Filter an array to only include current NBA teams
 * @param items - Array of items with team ID
 * @param getTeamId - Function to extract team ID from item
 * @returns Filtered array with only current teams
 */
export function filterCurrentTeams<T>(
  items: T[],
  getTeamId: (item: T) => number
): T[] {
  return items.filter((item) => isCurrentNBATeam(getTeamId(item)));
}
