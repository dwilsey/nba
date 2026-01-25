/**
 * Unified API client with automatic failover
 */

import { balldontlie } from './balldontlie';
import { oddsApi } from './odds';
import { backupApi } from './backup-api';
import { Game, Team, GameOdds } from '@/types';

class NBADataClient {
  private primaryFailed = false;
  private lastPrimaryAttempt = 0;
  private readonly RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private shouldRetryPrimary(): boolean {
    if (!this.primaryFailed) return true;
    return Date.now() - this.lastPrimaryAttempt > this.RETRY_INTERVAL;
  }

  private markPrimaryFailed(): void {
    this.primaryFailed = true;
    this.lastPrimaryAttempt = Date.now();
  }

  private markPrimarySuccess(): void {
    this.primaryFailed = false;
  }

  async getTeams(): Promise<Team[]> {
    if (this.shouldRetryPrimary()) {
      try {
        const teams = await balldontlie.getTeams();
        this.markPrimarySuccess();
        return teams;
      } catch (error) {
        console.error('Primary API failed for teams:', error);
        this.markPrimaryFailed();
      }
    }

    // Fallback to backup
    console.log('Using backup API for teams');
    return backupApi.getTeams();
  }

  async getTeam(id: number): Promise<Team | null> {
    if (this.shouldRetryPrimary()) {
      try {
        const team = await balldontlie.getTeam(id);
        this.markPrimarySuccess();
        return team;
      } catch (error) {
        console.error('Primary API failed for team:', error);
        this.markPrimaryFailed();
      }
    }

    return backupApi.getTeam(id);
  }

  async getTodaysGames(): Promise<Game[]> {
    if (this.shouldRetryPrimary()) {
      try {
        const games = await balldontlie.getTodaysGames();
        this.markPrimarySuccess();
        return games;
      } catch (error) {
        console.error('Primary API failed for today\'s games:', error);
        this.markPrimaryFailed();
      }
    }

    // Backup doesn't have live game data
    const today = new Date().toISOString().split('T')[0];
    return backupApi.getGames(today);
  }

  async getGames(startDate: string, endDate: string): Promise<Game[]> {
    if (this.shouldRetryPrimary()) {
      try {
        const games = await balldontlie.getGamesByDateRange(startDate, endDate);
        this.markPrimarySuccess();
        return games;
      } catch (error) {
        console.error('Primary API failed for games:', error);
        this.markPrimaryFailed();
      }
    }

    return [];
  }

  async getTeamRecentGames(teamId: number, count: number = 10): Promise<Game[]> {
    if (this.shouldRetryPrimary()) {
      try {
        const games = await balldontlie.getTeamRecentGames(teamId, count);
        this.markPrimarySuccess();
        return games;
      } catch (error) {
        console.error('Primary API failed for team games:', error);
        this.markPrimaryFailed();
      }
    }

    return [];
  }

  async getOdds(): Promise<GameOdds[]> {
    try {
      return await oddsApi.getOdds();
    } catch (error) {
      console.error('Odds API failed:', error);
      return [];
    }
  }

  async getGameOdds(eventId: string): Promise<GameOdds | null> {
    try {
      return await oddsApi.getEventOdds(eventId);
    } catch (error) {
      console.error('Odds API failed for event:', error);
      return null;
    }
  }

  getBestOdds(gameOdds: GameOdds) {
    return oddsApi.getBestOdds(gameOdds);
  }

  // Match team from odds data to our team database
  matchTeamFromOdds(oddsTeamName: string): Team | null {
    return backupApi.matchTeamFromOdds(oddsTeamName);
  }

  // Get API health status
  getStatus(): { primary: boolean; backup: boolean; odds: boolean } {
    return {
      primary: !this.primaryFailed,
      backup: backupApi.isAvailable(),
      odds: true, // Would need actual health check
    };
  }
}

export const nbaData = new NBADataClient();
export { balldontlie, oddsApi, backupApi };
export default nbaData;
