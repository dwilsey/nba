/**
 * NBA Season Utility
 *
 * NBA season naming convention:
 * - Season "2024" refers to the 2024-25 season (Oct 2024 - June 2025)
 * - The season year is based on when the season STARTS
 */

/**
 * Get the current NBA season year
 * Returns the year the season started (e.g., 2024 for the 2024-25 season)
 */
export function getCurrentNBASeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = January)
  const year = now.getFullYear();

  // NBA season starts in October (month 9)
  // If we're in Oct-Dec, the season is the current year
  // If we're in Jan-June, the season is the previous year
  // July-September is off-season, use the upcoming season
  if (month >= 9) {
    // October - December
    return year;
  } else if (month <= 5) {
    // January - June
    return year - 1;
  } else {
    // July - September (off-season)
    return year;
  }
}

/**
 * Get the date range for a given NBA season
 */
export function getSeasonDateRange(season: number): { start: string; end: string } {
  return {
    start: `${season}-10-01`, // Season starts in October
    end: `${season + 1}-06-30`, // Season ends in June
  };
}

/**
 * Format season for display (e.g., "2024-25")
 */
export function formatSeasonDisplay(season: number): string {
  return `${season}-${String(season + 1).slice(-2)}`;
}

/**
 * Check if a date falls within an NBA season
 */
export function isDateInSeason(date: Date, season: number): boolean {
  const { start, end } = getSeasonDateRange(season);
  const startDate = new Date(start);
  const endDate = new Date(end);
  return date >= startDate && date <= endDate;
}

/**
 * Get the season for a specific date
 */
export function getSeasonForDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();

  if (month >= 9) {
    return year;
  } else if (month <= 5) {
    return year - 1;
  } else {
    return year;
  }
}
