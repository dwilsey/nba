export type OddsType = 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'PARLAY';
export type BetResult = 'PENDING' | 'WIN' | 'LOSS' | 'PUSH' | 'VOID';
export type GameStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL' | 'POSTPONED' | 'CANCELLED';

export interface Team {
  id: number;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  full_name: string;
  name: string;
}

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  college: string;
  country: string;
  draft_year: number | null;
  draft_round: number | null;
  draft_number: number | null;
  team: Team;
}

export interface Game {
  id: number;
  date: string;
  home_team: Team;
  home_team_score: number;
  visitor_team: Team;
  visitor_team_score: number;
  season: number;
  status: string;
  time: string;
  period: number;
  postseason: boolean;
}

export interface PlayerStats {
  id: number;
  ast: number;
  blk: number;
  dreb: number;
  fg3_pct: number;
  fg3a: number;
  fg3m: number;
  fg_pct: number;
  fga: number;
  fgm: number;
  ft_pct: number;
  fta: number;
  ftm: number;
  game: Game;
  min: string;
  oreb: number;
  pf: number;
  player: Player;
  pts: number;
  reb: number;
  stl: number;
  team: Team;
  turnover: number;
}

export interface TeamStats {
  wins: number;
  losses: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  pointsPerGame: number;
  pointsAgainst: number;
  streak: number;
  last10Wins: number;
  last10Losses: number;
}

export interface Odds {
  bookmaker: string;
  homeMoneyline: number;
  awayMoneyline: number;
  spread: number;
  spreadOdds: number;
  total: number;
  overOdds: number;
  underOdds: number;
  lastUpdate: string;
}

export interface GameOdds {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: Odds[];
}

export interface Prediction {
  id: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  predictedWinner: string;
  confidence: number;
  homeWinProbability: number;
  awayWinProbability: number;
  spreadPrediction?: number;
  totalPrediction?: number;
  factors?: PredictionFactors;
}

export interface PredictionFactors {
  winPercentage: { home: number; away: number };
  recentForm: { home: number; away: number };
  homeCourtAdvantage: number;
  headToHead: { home: number; away: number };
  restDays: { home: number; away: number };
  injuries: { home: string[]; away: string[] };
}

export interface Bet {
  id: string;
  userId: string;
  oddsType: OddsType;
  team: string;
  opponent: string;
  odds: number;
  amount: number;
  result: BetResult;
  profit?: number;
  gameDate: Date;
  gameId?: string;
  notes?: string;
  createdAt: Date;
}

export interface UserAnalytics {
  totalBets: number;
  totalWagered: number;
  totalProfit: number;
  winRate: number;
  roi: number;
  byOddsType: {
    type: OddsType;
    bets: number;
    profit: number;
    winRate: number;
  }[];
  recentPerformance: {
    date: string;
    profit: number;
    cumulative: number;
  }[];
}

export interface APIResponse<T> {
  data: T;
  meta?: {
    total_pages: number;
    current_page: number;
    next_page: number | null;
    per_page: number;
    total_count: number;
  };
}
