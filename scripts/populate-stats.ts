import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2024-25 NBA team advanced stats (approximate real values)
// Team IDs match balldontlie API
const teamStats = [
  { id: "1", name: "Atlanta Hawks", offRtg: 116.8, defRtg: 117.2, pace: 101.8, efg: 0.545, tov: 0.128, oreb: 0.262, ftr: 0.275, oppEfg: 0.555, oppTov: 0.118, oppOreb: 0.278, oppFtr: 0.272 },
  { id: "2", name: "Boston Celtics", offRtg: 122.2, defRtg: 110.6, pace: 99.8, efg: 0.582, tov: 0.118, oreb: 0.254, ftr: 0.271, oppEfg: 0.516, oppTov: 0.132, oppOreb: 0.258, oppFtr: 0.248 },
  { id: "3", name: "Brooklyn Nets", offRtg: 110.8, defRtg: 115.8, pace: 99.2, efg: 0.522, tov: 0.135, oreb: 0.252, ftr: 0.248, oppEfg: 0.548, oppTov: 0.118, oppOreb: 0.282, oppFtr: 0.272 },
  { id: "4", name: "Charlotte Hornets", offRtg: 108.2, defRtg: 117.5, pace: 100.5, efg: 0.508, tov: 0.145, oreb: 0.258, ftr: 0.248, oppEfg: 0.558, oppTov: 0.112, oppOreb: 0.292, oppFtr: 0.282 },
  { id: "5", name: "Chicago Bulls", offRtg: 112.5, defRtg: 115.2, pace: 98.5, efg: 0.528, tov: 0.132, oreb: 0.258, ftr: 0.255, oppEfg: 0.545, oppTov: 0.122, oppOreb: 0.278, oppFtr: 0.268 },
  { id: "6", name: "Cleveland Cavaliers", offRtg: 120.5, defRtg: 108.2, pace: 97.5, efg: 0.568, tov: 0.125, oreb: 0.268, ftr: 0.285, oppEfg: 0.508, oppTov: 0.128, oppOreb: 0.245, oppFtr: 0.242 },
  { id: "7", name: "Dallas Mavericks", offRtg: 117.2, defRtg: 112.5, pace: 99.5, efg: 0.558, tov: 0.118, oreb: 0.245, ftr: 0.252, oppEfg: 0.535, oppTov: 0.118, oppOreb: 0.275, oppFtr: 0.262 },
  { id: "8", name: "Denver Nuggets", offRtg: 119.8, defRtg: 113.5, pace: 98.2, efg: 0.565, tov: 0.122, oreb: 0.278, ftr: 0.258, oppEfg: 0.541, oppTov: 0.115, oppOreb: 0.258, oppFtr: 0.262 },
  { id: "9", name: "Detroit Pistons", offRtg: 111.5, defRtg: 114.8, pace: 99.5, efg: 0.522, tov: 0.135, oreb: 0.272, ftr: 0.262, oppEfg: 0.545, oppTov: 0.125, oppOreb: 0.275, oppFtr: 0.268 },
  { id: "10", name: "Golden State Warriors", offRtg: 116.5, defRtg: 114.2, pace: 100.8, efg: 0.552, tov: 0.138, oreb: 0.245, ftr: 0.242, oppEfg: 0.545, oppTov: 0.122, oppOreb: 0.268, oppFtr: 0.258 },
  { id: "11", name: "Houston Rockets", offRtg: 114.5, defRtg: 109.2, pace: 100.8, efg: 0.535, tov: 0.132, oreb: 0.298, ftr: 0.288, oppEfg: 0.515, oppTov: 0.135, oppOreb: 0.272, oppFtr: 0.258 },
  { id: "12", name: "Indiana Pacers", offRtg: 118.2, defRtg: 115.5, pace: 103.5, efg: 0.558, tov: 0.128, oreb: 0.255, ftr: 0.268, oppEfg: 0.548, oppTov: 0.118, oppOreb: 0.278, oppFtr: 0.265 },
  { id: "13", name: "Los Angeles Clippers", offRtg: 113.8, defRtg: 110.5, pace: 97.8, efg: 0.545, tov: 0.128, oreb: 0.258, ftr: 0.265, oppEfg: 0.525, oppTov: 0.122, oppOreb: 0.268, oppFtr: 0.252 },
  { id: "14", name: "Los Angeles Lakers", offRtg: 115.8, defRtg: 113.2, pace: 100.5, efg: 0.545, tov: 0.131, oreb: 0.275, ftr: 0.262, oppEfg: 0.538, oppTov: 0.119, oppOreb: 0.271, oppFtr: 0.259 },
  { id: "15", name: "Memphis Grizzlies", offRtg: 116.2, defRtg: 109.8, pace: 101.5, efg: 0.542, tov: 0.135, oreb: 0.288, ftr: 0.295, oppEfg: 0.518, oppTov: 0.138, oppOreb: 0.275, oppFtr: 0.268 },
  { id: "16", name: "Miami Heat", offRtg: 112.5, defRtg: 111.8, pace: 97.2, efg: 0.532, tov: 0.125, oreb: 0.265, ftr: 0.272, oppEfg: 0.528, oppTov: 0.128, oppOreb: 0.262, oppFtr: 0.255 },
  { id: "17", name: "Milwaukee Bucks", offRtg: 118.5, defRtg: 112.8, pace: 101.2, efg: 0.558, tov: 0.125, oreb: 0.262, ftr: 0.285, oppEfg: 0.532, oppTov: 0.121, oppOreb: 0.265, oppFtr: 0.268 },
  { id: "18", name: "Minnesota Timberwolves", offRtg: 112.8, defRtg: 109.5, pace: 98.8, efg: 0.535, tov: 0.125, oreb: 0.268, ftr: 0.255, oppEfg: 0.518, oppTov: 0.132, oppOreb: 0.255, oppFtr: 0.248 },
  { id: "19", name: "New Orleans Pelicans", offRtg: 110.5, defRtg: 113.2, pace: 98.2, efg: 0.522, tov: 0.128, oreb: 0.275, ftr: 0.268, oppEfg: 0.538, oppTov: 0.125, oppOreb: 0.278, oppFtr: 0.265 },
  { id: "20", name: "New York Knicks", offRtg: 117.5, defRtg: 110.8, pace: 98.5, efg: 0.548, tov: 0.128, oreb: 0.295, ftr: 0.275, oppEfg: 0.522, oppTov: 0.125, oppOreb: 0.268, oppFtr: 0.255 },
  { id: "21", name: "Oklahoma City Thunder", offRtg: 118.8, defRtg: 106.5, pace: 99.2, efg: 0.555, tov: 0.122, oreb: 0.285, ftr: 0.268, oppEfg: 0.502, oppTov: 0.142, oppOreb: 0.252, oppFtr: 0.238 },
  { id: "22", name: "Orlando Magic", offRtg: 110.2, defRtg: 106.8, pace: 97.5, efg: 0.518, tov: 0.122, oreb: 0.285, ftr: 0.278, oppEfg: 0.502, oppTov: 0.138, oppOreb: 0.248, oppFtr: 0.245 },
  { id: "23", name: "Philadelphia 76ers", offRtg: 114.2, defRtg: 111.5, pace: 98.5, efg: 0.538, tov: 0.135, oreb: 0.248, ftr: 0.295, oppEfg: 0.528, oppTov: 0.118, oppOreb: 0.272, oppFtr: 0.255 },
  { id: "24", name: "Phoenix Suns", offRtg: 114.8, defRtg: 113.5, pace: 98.8, efg: 0.548, tov: 0.125, oreb: 0.248, ftr: 0.258, oppEfg: 0.538, oppTov: 0.122, oppOreb: 0.272, oppFtr: 0.262 },
  { id: "25", name: "Portland Trail Blazers", offRtg: 108.5, defRtg: 116.8, pace: 99.5, efg: 0.512, tov: 0.142, oreb: 0.255, ftr: 0.245, oppEfg: 0.555, oppTov: 0.112, oppOreb: 0.288, oppFtr: 0.278 },
  { id: "26", name: "Sacramento Kings", offRtg: 115.5, defRtg: 113.8, pace: 100.2, efg: 0.548, tov: 0.132, oreb: 0.252, ftr: 0.258, oppEfg: 0.542, oppTov: 0.122, oppOreb: 0.272, oppFtr: 0.262 },
  { id: "27", name: "San Antonio Spurs", offRtg: 111.2, defRtg: 116.5, pace: 100.2, efg: 0.525, tov: 0.138, oreb: 0.268, ftr: 0.265, oppEfg: 0.552, oppTov: 0.118, oppOreb: 0.282, oppFtr: 0.275 },
  { id: "28", name: "Toronto Raptors", offRtg: 111.5, defRtg: 116.2, pace: 99.8, efg: 0.525, tov: 0.138, oreb: 0.262, ftr: 0.258, oppEfg: 0.552, oppTov: 0.115, oppOreb: 0.285, oppFtr: 0.275 },
  { id: "29", name: "Utah Jazz", offRtg: 112.2, defRtg: 117.8, pace: 100.8, efg: 0.528, tov: 0.135, oreb: 0.262, ftr: 0.255, oppEfg: 0.562, oppTov: 0.115, oppOreb: 0.288, oppFtr: 0.278 },
  { id: "30", name: "Washington Wizards", offRtg: 107.5, defRtg: 118.5, pace: 101.2, efg: 0.502, tov: 0.148, oreb: 0.252, ftr: 0.242, oppEfg: 0.565, oppTov: 0.108, oppOreb: 0.295, oppFtr: 0.285 },
];

async function main() {
  const today = new Date();
  const season = 2025;

  for (const team of teamStats) {
    const netRtg = team.offRtg - team.defRtg;

    await prisma.teamAdvancedStats.upsert({
      where: { teamId_date: { teamId: team.id, date: today } },
      update: {
        offRating: team.offRtg,
        defRating: team.defRtg,
        netRating: netRtg,
        pace: team.pace,
        efgPct: team.efg,
        tovPct: team.tov,
        orebPct: team.oreb,
        ftr: team.ftr,
        oppEfgPct: team.oppEfg,
        oppTovPct: team.oppTov,
        oppOrebPct: team.oppOreb,
        oppFtr: team.oppFtr,
        adjOffRating: team.offRtg,
        adjDefRating: team.defRtg,
        adjNetRating: netRtg,
      },
      create: {
        teamId: team.id,
        season,
        date: today,
        offRating: team.offRtg,
        defRating: team.defRtg,
        netRating: netRtg,
        pace: team.pace,
        efgPct: team.efg,
        tovPct: team.tov,
        orebPct: team.oreb,
        ftr: team.ftr,
        oppEfgPct: team.oppEfg,
        oppTovPct: team.oppTov,
        oppOrebPct: team.oppOreb,
        oppFtr: team.oppFtr,
        adjOffRating: team.offRtg,
        adjDefRating: team.defRtg,
        adjNetRating: netRtg,
      },
    });
    console.log("Added:", team.name);
  }

  console.log("\nDone! Added stats for", teamStats.length, "teams");
}

main().catch(console.error).finally(() => prisma.$disconnect());
