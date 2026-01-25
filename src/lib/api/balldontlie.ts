import { Game, Team, Player, PlayerStats, APIResponse } from '@/types';

const BASE_URL = 'https://api.balldontlie.io/v1';

interface RequestOptions {
  params?: Record<string, string | number | undefined>;
}

class BallDontLieClient {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.BALLDONTLIE_API_KEY;
  }

  private async fetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = this.apiKey;
    }

    const response = await fetch(url.toString(), {
      headers,
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`BallDontLie API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getTeams(): Promise<Team[]> {
    const response = await this.fetch<APIResponse<Team[]>>('/teams');
    return response.data;
  }

  async getTeam(id: number): Promise<Team> {
    const response = await this.fetch<APIResponse<Team>>(`/teams/${id}`);
    return response.data;
  }

  async getPlayers(options?: {
    page?: number;
    perPage?: number;
    search?: string;
    teamIds?: number[];
  }): Promise<APIResponse<Player[]>> {
    return this.fetch<APIResponse<Player[]>>('/players', {
      params: {
        page: options?.page,
        per_page: options?.perPage,
        search: options?.search,
        'team_ids[]': options?.teamIds?.join(','),
      },
    });
  }

  async getPlayer(id: number): Promise<Player> {
    const response = await this.fetch<APIResponse<Player>>(`/players/${id}`);
    return response.data;
  }

  async getGames(options?: {
    page?: number;
    perPage?: number;
    dates?: string[];
    seasons?: number[];
    teamIds?: number[];
    postseason?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<APIResponse<Game[]>> {
    const params: Record<string, string | number | undefined> = {
      page: options?.page,
      per_page: options?.perPage,
      postseason: options?.postseason ? 'true' : undefined,
      start_date: options?.startDate,
      end_date: options?.endDate,
    };

    if (options?.dates?.length) {
      params['dates[]'] = options.dates.join(',');
    }
    if (options?.seasons?.length) {
      params['seasons[]'] = options.seasons.join(',');
    }
    if (options?.teamIds?.length) {
      params['team_ids[]'] = options.teamIds.join(',');
    }

    return this.fetch<APIResponse<Game[]>>('/games', { params });
  }

  async getGame(id: number): Promise<Game> {
    const response = await this.fetch<APIResponse<Game>>(`/games/${id}`);
    return response.data;
  }

  async getStats(options?: {
    page?: number;
    perPage?: number;
    dates?: string[];
    seasons?: number[];
    playerIds?: number[];
    gameIds?: number[];
    postseason?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<APIResponse<PlayerStats[]>> {
    const params: Record<string, string | number | undefined> = {
      page: options?.page,
      per_page: options?.perPage,
      postseason: options?.postseason ? 'true' : undefined,
      start_date: options?.startDate,
      end_date: options?.endDate,
    };

    if (options?.dates?.length) {
      params['dates[]'] = options.dates.join(',');
    }
    if (options?.seasons?.length) {
      params['seasons[]'] = options.seasons.join(',');
    }
    if (options?.playerIds?.length) {
      params['player_ids[]'] = options.playerIds.join(',');
    }
    if (options?.gameIds?.length) {
      params['game_ids[]'] = options.gameIds.join(',');
    }

    return this.fetch<APIResponse<PlayerStats[]>>('/stats', { params });
  }

  async getSeasonAverages(options: {
    season?: number;
    playerIds: number[];
  }): Promise<APIResponse<PlayerStats[]>> {
    return this.fetch<APIResponse<PlayerStats[]>>('/season_averages', {
      params: {
        season: options.season,
        'player_ids[]': options.playerIds.join(','),
      },
    });
  }

  // Helper to get today's games
  async getTodaysGames(): Promise<Game[]> {
    const today = new Date().toISOString().split('T')[0];
    const response = await this.getGames({ dates: [today] });
    return response.data;
  }

  // Helper to get games for a date range
  async getGamesByDateRange(startDate: string, endDate: string): Promise<Game[]> {
    const allGames: Game[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getGames({
        startDate,
        endDate,
        page,
        perPage: 100,
      });

      allGames.push(...response.data);

      if (!response.meta?.next_page) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allGames;
  }

  // Helper to get team's recent completed games (for historical stats)
  async getTeamRecentGames(teamId: number, count: number = 10): Promise<Game[]> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const response = await this.getGames({
      teamIds: [teamId],
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      perPage: count,
    });

    return response.data
      .filter((game) => game.status === 'Final')
      .slice(0, count);
  }

  // Helper to get upcoming/scheduled games
  async getUpcomingGames(days: number = 7): Promise<Game[]> {
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    const response = await this.getGames({
      startDate: today.toISOString().split('T')[0],
      endDate: futureDate.toISOString().split('T')[0],
      perPage: 100,
    });

    // Return scheduled and in-progress games (not yet final)
    return response.data.filter((game) => game.status !== 'Final');
  }

  // Helper to get all games for today (regardless of status)
  async getAllTodaysGames(): Promise<Game[]> {
    const today = new Date().toISOString().split('T')[0];
    const response = await this.getGames({ dates: [today], perPage: 100 });
    return response.data;
  }
}

export const balldontlie = new BallDontLieClient();
export default balldontlie;
