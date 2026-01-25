import { GameOdds, Odds } from '@/types';

const BASE_URL = 'https://api.the-odds-api.com/v4';
const SPORT = 'basketball_nba';

interface OddsAPIResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: BookmakerResponse[];
}

interface BookmakerResponse {
  key: string;
  title: string;
  last_update: string;
  markets: MarketResponse[];
}

interface MarketResponse {
  key: string;
  last_update: string;
  outcomes: OutcomeResponse[];
}

interface OutcomeResponse {
  name: string;
  price: number;
  point?: number;
}

class OddsAPIClient {
  private apiKey: string;
  private remainingRequests: number | null = null;

  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || '';
  }

  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY is not configured');
    }

    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('apiKey', this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      next: { revalidate: 900 }, // Cache for 15 minutes to conserve API calls
    });

    // Track remaining requests from headers
    const remaining = response.headers.get('x-requests-remaining');
    if (remaining) {
      this.remainingRequests = parseInt(remaining, 10);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid ODDS_API_KEY');
      }
      if (response.status === 429) {
        throw new Error('Odds API rate limit exceeded');
      }
      throw new Error(`Odds API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  getRemainingRequests(): number | null {
    return this.remainingRequests;
  }

  async getOdds(options?: {
    regions?: string;
    markets?: string;
    oddsFormat?: string;
    bookmakers?: string[];
  }): Promise<GameOdds[]> {
    const params: Record<string, string> = {
      regions: options?.regions || 'us',
      markets: options?.markets || 'h2h,spreads,totals',
      oddsFormat: options?.oddsFormat || 'american',
    };

    if (options?.bookmakers?.length) {
      params.bookmakers = options.bookmakers.join(',');
    }

    const response = await this.fetch<OddsAPIResponse[]>(
      `/sports/${SPORT}/odds`,
      params
    );

    return response.map(this.transformOddsResponse);
  }

  async getEventOdds(eventId: string, options?: {
    regions?: string;
    markets?: string;
    oddsFormat?: string;
  }): Promise<GameOdds | null> {
    try {
      const params: Record<string, string> = {
        regions: options?.regions || 'us',
        markets: options?.markets || 'h2h,spreads,totals',
        oddsFormat: options?.oddsFormat || 'american',
      };

      const response = await this.fetch<OddsAPIResponse>(
        `/sports/${SPORT}/events/${eventId}/odds`,
        params
      );

      return this.transformOddsResponse(response);
    } catch {
      return null;
    }
  }

  private transformOddsResponse(response: OddsAPIResponse): GameOdds {
    const bookmakers: Odds[] = response.bookmakers.map((bookmaker) => {
      const h2h = bookmaker.markets.find((m) => m.key === 'h2h');
      const spreads = bookmaker.markets.find((m) => m.key === 'spreads');
      const totals = bookmaker.markets.find((m) => m.key === 'totals');

      const homeH2H = h2h?.outcomes.find((o) => o.name === response.home_team);
      const awayH2H = h2h?.outcomes.find((o) => o.name === response.away_team);
      const homeSpread = spreads?.outcomes.find((o) => o.name === response.home_team);
      const over = totals?.outcomes.find((o) => o.name === 'Over');
      const under = totals?.outcomes.find((o) => o.name === 'Under');

      return {
        bookmaker: bookmaker.title,
        homeMoneyline: homeH2H?.price || 0,
        awayMoneyline: awayH2H?.price || 0,
        spread: homeSpread?.point || 0,
        spreadOdds: homeSpread?.price || -110,
        total: over?.point || 0,
        overOdds: over?.price || -110,
        underOdds: under?.price || -110,
        lastUpdate: bookmaker.last_update,
      };
    });

    return {
      gameId: response.id,
      homeTeam: response.home_team,
      awayTeam: response.away_team,
      commenceTime: response.commence_time,
      bookmakers,
    };
  }

  // Get the best available odds across all bookmakers
  getBestOdds(gameOdds: GameOdds): Odds | null {
    if (!gameOdds.bookmakers.length) return null;

    const best: Odds = {
      bookmaker: 'Best Available',
      homeMoneyline: -Infinity,
      awayMoneyline: -Infinity,
      spread: gameOdds.bookmakers[0].spread,
      spreadOdds: -Infinity,
      total: gameOdds.bookmakers[0].total,
      overOdds: -Infinity,
      underOdds: -Infinity,
      lastUpdate: new Date().toISOString(),
    };

    for (const odds of gameOdds.bookmakers) {
      // For American odds, higher is better (less negative or more positive)
      if (odds.homeMoneyline > best.homeMoneyline) {
        best.homeMoneyline = odds.homeMoneyline;
      }
      if (odds.awayMoneyline > best.awayMoneyline) {
        best.awayMoneyline = odds.awayMoneyline;
      }
      if (odds.spreadOdds > best.spreadOdds) {
        best.spreadOdds = odds.spreadOdds;
        best.spread = odds.spread;
      }
      if (odds.overOdds > best.overOdds) {
        best.overOdds = odds.overOdds;
        best.total = odds.total;
      }
      if (odds.underOdds > best.underOdds) {
        best.underOdds = odds.underOdds;
      }
    }

    return best;
  }

  // Calculate implied probability from American odds
  static impliedProbability(americanOdds: number): number {
    if (americanOdds > 0) {
      return 100 / (americanOdds + 100);
    }
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }

  // Convert American odds to decimal
  static americanToDecimal(americanOdds: number): number {
    if (americanOdds > 0) {
      return americanOdds / 100 + 1;
    }
    return 100 / Math.abs(americanOdds) + 1;
  }
}

export const oddsApi = new OddsAPIClient();
export default oddsApi;
