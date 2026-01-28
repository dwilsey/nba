/**
 * Daily stats refresh cron endpoint.
 *
 * Fetches and updates team advanced stats and player BPM data
 * for the XGBoost model.
 *
 * This endpoint should be called daily (e.g., via Vercel Cron or external scheduler).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Basketball Reference team abbreviations
const NBA_TEAMS = [
  { abbr: "ATL", name: "Atlanta Hawks" },
  { abbr: "BOS", name: "Boston Celtics" },
  { abbr: "BRK", name: "Brooklyn Nets" },
  { abbr: "CHO", name: "Charlotte Hornets" },
  { abbr: "CHI", name: "Chicago Bulls" },
  { abbr: "CLE", name: "Cleveland Cavaliers" },
  { abbr: "DAL", name: "Dallas Mavericks" },
  { abbr: "DEN", name: "Denver Nuggets" },
  { abbr: "DET", name: "Detroit Pistons" },
  { abbr: "GSW", name: "Golden State Warriors" },
  { abbr: "HOU", name: "Houston Rockets" },
  { abbr: "IND", name: "Indiana Pacers" },
  { abbr: "LAC", name: "Los Angeles Clippers" },
  { abbr: "LAL", name: "Los Angeles Lakers" },
  { abbr: "MEM", name: "Memphis Grizzlies" },
  { abbr: "MIA", name: "Miami Heat" },
  { abbr: "MIL", name: "Milwaukee Bucks" },
  { abbr: "MIN", name: "Minnesota Timberwolves" },
  { abbr: "NOP", name: "New Orleans Pelicans" },
  { abbr: "NYK", name: "New York Knicks" },
  { abbr: "OKC", name: "Oklahoma City Thunder" },
  { abbr: "ORL", name: "Orlando Magic" },
  { abbr: "PHI", name: "Philadelphia 76ers" },
  { abbr: "PHO", name: "Phoenix Suns" },
  { abbr: "POR", name: "Portland Trail Blazers" },
  { abbr: "SAC", name: "Sacramento Kings" },
  { abbr: "SAS", name: "San Antonio Spurs" },
  { abbr: "TOR", name: "Toronto Raptors" },
  { abbr: "UTA", name: "Utah Jazz" },
  { abbr: "WAS", name: "Washington Wizards" },
];

// Rate limiting: 20 requests per minute
const RATE_LIMIT_DELAY = 3000; // 3 seconds between requests

interface TeamStatsResult {
  teamAbbr: string;
  success: boolean;
  error?: string;
}

interface BPMResult {
  teamAbbr: string;
  playersUpdated: number;
  error?: string;
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch team advanced stats from Python service or fallback.
 *
 * In production, this would call the Python service's basketball_ref scraper.
 * For now, we'll generate reasonable default values.
 */
async function fetchTeamStats(
  teamAbbr: string
): Promise<{
  offRating: number;
  defRating: number;
  netRating: number;
  pace: number;
  efgPct: number;
  tovPct: number;
  orebPct: number;
  ftr: number;
  oppEfgPct: number;
  oppTovPct: number;
  oppOrebPct: number;
  oppFtr: number;
  adjOffRating?: number;
  adjDefRating?: number;
  adjNetRating?: number;
  sosOrtg?: number;
  sosDrtg?: number;
} | null> {
  const xgboostServiceUrl =
    process.env.XGBOOST_SERVICE_URL || "http://localhost:8000";

  try {
    // Try to get stats from Python service
    const response = await fetch(
      `${xgboostServiceUrl}/features/team/${teamAbbr}`,
      { next: { revalidate: 0 } }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        offRating: data.off_rating,
        defRating: data.def_rating,
        netRating: data.net_rating,
        pace: data.pace,
        efgPct: data.efg_pct,
        tovPct: data.tov_pct,
        orebPct: data.oreb_pct,
        ftr: data.ftr,
        oppEfgPct: data.opp_efg_pct,
        oppTovPct: data.opp_tov_pct,
        oppOrebPct: data.opp_oreb_pct,
        oppFtr: data.opp_ftr,
        adjOffRating: data.adj_off_rating,
        adjDefRating: data.adj_def_rating,
        adjNetRating: data.adj_net_rating,
        sosOrtg: data.sos_ortg,
        sosDrtg: data.sos_drtg,
      };
    }
  } catch {
    // Service unavailable, use fallback
  }

  // Fallback: Return null to skip this team
  // In production, this would scrape Basketball Reference directly
  return null;
}

/**
 * GET /api/cron/refresh-stats
 *
 * Refresh team advanced stats for all NBA teams.
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET> (for Vercel Cron)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: {
    teamStats: TeamStatsResult[];
    bpm: BPMResult[];
    totalTime: number;
  } = {
    teamStats: [],
    bpm: [],
    totalTime: 0,
  };

  const currentSeason = new Date().getFullYear();
  const today = new Date();

  console.log(`Starting stats refresh for ${NBA_TEAMS.length} teams...`);

  // Fetch and update team stats
  for (const team of NBA_TEAMS) {
    try {
      const stats = await fetchTeamStats(team.abbr);

      if (stats) {
        // Find team ID from database
        const dbTeam = await prisma.team.findFirst({
          where: {
            OR: [
              { abbreviation: team.abbr },
              { name: { contains: team.name.split(" ").pop() } },
            ],
          },
        });

        const teamId = dbTeam?.id || team.abbr;

        await prisma.teamAdvancedStats.upsert({
          where: {
            teamId_date: {
              teamId,
              date: today,
            },
          },
          update: {
            offRating: stats.offRating,
            defRating: stats.defRating,
            netRating: stats.netRating,
            pace: stats.pace,
            efgPct: stats.efgPct,
            tovPct: stats.tovPct,
            orebPct: stats.orebPct,
            ftr: stats.ftr,
            oppEfgPct: stats.oppEfgPct,
            oppTovPct: stats.oppTovPct,
            oppOrebPct: stats.oppOrebPct,
            oppFtr: stats.oppFtr,
            adjOffRating: stats.adjOffRating,
            adjDefRating: stats.adjDefRating,
            adjNetRating: stats.adjNetRating,
            sosOrtg: stats.sosOrtg,
            sosDrtg: stats.sosDrtg,
          },
          create: {
            teamId,
            season: currentSeason,
            date: today,
            offRating: stats.offRating,
            defRating: stats.defRating,
            netRating: stats.netRating,
            pace: stats.pace,
            efgPct: stats.efgPct,
            tovPct: stats.tovPct,
            orebPct: stats.orebPct,
            ftr: stats.ftr,
            oppEfgPct: stats.oppEfgPct,
            oppTovPct: stats.oppTovPct,
            oppOrebPct: stats.oppOrebPct,
            oppFtr: stats.oppFtr,
            adjOffRating: stats.adjOffRating,
            adjDefRating: stats.adjDefRating,
            adjNetRating: stats.adjNetRating,
            sosOrtg: stats.sosOrtg,
            sosDrtg: stats.sosDrtg,
          },
        });

        results.teamStats.push({ teamAbbr: team.abbr, success: true });
      } else {
        results.teamStats.push({
          teamAbbr: team.abbr,
          success: false,
          error: "No stats available",
        });
      }

      // Rate limiting
      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      results.teamStats.push({
        teamAbbr: team.abbr,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  results.totalTime = Date.now() - startTime;

  const successCount = results.teamStats.filter((r) => r.success).length;

  console.log(
    `Stats refresh complete: ${successCount}/${NBA_TEAMS.length} teams updated in ${results.totalTime}ms`
  );

  return NextResponse.json({
    success: true,
    summary: {
      teamsUpdated: successCount,
      teamsTotal: NBA_TEAMS.length,
      timeMs: results.totalTime,
    },
    details: results,
  });
}

/**
 * POST /api/cron/refresh-stats
 *
 * Manually trigger stats refresh with options.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teams, forceRefresh } = body as {
      teams?: string[];
      forceRefresh?: boolean;
    };

    // Filter teams if specified
    const teamsToUpdate = teams
      ? NBA_TEAMS.filter((t) => teams.includes(t.abbr))
      : NBA_TEAMS;

    const results: TeamStatsResult[] = [];
    const currentSeason = new Date().getFullYear();
    const today = new Date();

    for (const team of teamsToUpdate) {
      try {
        // Check if we already have recent stats (unless force refresh)
        if (!forceRefresh) {
          const existing = await prisma.teamAdvancedStats.findFirst({
            where: {
              teamId: team.abbr,
              date: {
                gte: new Date(today.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
            },
          });

          if (existing) {
            results.push({
              teamAbbr: team.abbr,
              success: true,
              error: "Already up to date",
            });
            continue;
          }
        }

        const stats = await fetchTeamStats(team.abbr);

        if (stats) {
          await prisma.teamAdvancedStats.upsert({
            where: {
              teamId_date: {
                teamId: team.abbr,
                date: today,
              },
            },
            update: {
              offRating: stats.offRating,
              defRating: stats.defRating,
              netRating: stats.netRating,
              pace: stats.pace,
              efgPct: stats.efgPct,
              tovPct: stats.tovPct,
              orebPct: stats.orebPct,
              ftr: stats.ftr,
              oppEfgPct: stats.oppEfgPct,
              oppTovPct: stats.oppTovPct,
              oppOrebPct: stats.oppOrebPct,
              oppFtr: stats.oppFtr,
              adjOffRating: stats.adjOffRating,
              adjDefRating: stats.adjDefRating,
              adjNetRating: stats.adjNetRating,
              sosOrtg: stats.sosOrtg,
              sosDrtg: stats.sosDrtg,
            },
            create: {
              teamId: team.abbr,
              season: currentSeason,
              date: today,
              offRating: stats.offRating,
              defRating: stats.defRating,
              netRating: stats.netRating,
              pace: stats.pace,
              efgPct: stats.efgPct,
              tovPct: stats.tovPct,
              orebPct: stats.orebPct,
              ftr: stats.ftr,
              oppEfgPct: stats.oppEfgPct,
              oppTovPct: stats.oppTovPct,
              oppOrebPct: stats.oppOrebPct,
              oppFtr: stats.oppFtr,
              adjOffRating: stats.adjOffRating,
              adjDefRating: stats.adjDefRating,
              adjNetRating: stats.adjNetRating,
              sosOrtg: stats.sosOrtg,
              sosDrtg: stats.sosDrtg,
            },
          });

          results.push({ teamAbbr: team.abbr, success: true });
        } else {
          results.push({
            teamAbbr: team.abbr,
            success: false,
            error: "No stats available",
          });
        }

        await sleep(RATE_LIMIT_DELAY);
      } catch (error) {
        results.push({
          teamAbbr: team.abbr,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      teamsUpdated: successCount,
      teamsTotal: teamsToUpdate.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to refresh stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
