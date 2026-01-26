import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initial ELO ratings based on preseason projections
// 1500 is league average, top teams ~1600-1650, bottom teams ~1350-1400
const INITIAL_ELO_RATINGS: Record<string, number> = {
  // Elite tier
  'Boston Celtics': 1650,
  'Denver Nuggets': 1620,
  'Oklahoma City Thunder': 1610,
  'Cleveland Cavaliers': 1605,

  // Contenders
  'Phoenix Suns': 1580,
  'Milwaukee Bucks': 1575,
  'Minnesota Timberwolves': 1570,
  'New York Knicks': 1565,
  'Dallas Mavericks': 1560,
  'Philadelphia 76ers': 1555,

  // Playoff teams
  'Miami Heat': 1540,
  'Los Angeles Lakers': 1535,
  'Sacramento Kings': 1530,
  'Indiana Pacers': 1525,
  'Golden State Warriors': 1520,
  'Los Angeles Clippers': 1515,
  'New Orleans Pelicans': 1510,
  'Orlando Magic': 1505,

  // Bubble teams
  'Houston Rockets': 1490,
  'Chicago Bulls': 1480,
  'Atlanta Hawks': 1475,
  'Memphis Grizzlies': 1470,
  'Toronto Raptors': 1465,

  // Rebuilding
  'Brooklyn Nets': 1440,
  'San Antonio Spurs': 1420,
  'Utah Jazz': 1410,
  'Portland Trail Blazers': 1400,
  'Charlotte Hornets': 1390,
  'Detroit Pistons': 1380,
  'Washington Wizards': 1370,
};

// Default ELO for teams not in the list
const DEFAULT_ELO = 1500;

async function main() {
  console.log('Initializing ELO ratings for all teams...');

  const teams = await prisma.team.findMany();

  if (teams.length === 0) {
    console.error('No teams found. Please run prisma db seed first.');
    process.exit(1);
  }

  const today = new Date();
  const seasonStartDate = new Date(today.getFullYear(), 9, 1); // October 1st

  for (const team of teams) {
    const initialElo = INITIAL_ELO_RATINGS[team.fullName] || DEFAULT_ELO;

    // Create initial ELO history entry
    await prisma.eloHistory.upsert({
      where: {
        id: `init-${team.id}`,
      },
      update: {
        elo: initialElo,
        change: 0,
        date: seasonStartDate,
      },
      create: {
        id: `init-${team.id}`,
        teamId: team.id,
        elo: initialElo,
        gameId: 'season-start',
        change: 0,
        date: seasonStartDate,
        isPlayoff: false,
      },
    });

    console.log(`  ${team.fullName}: ${initialElo}`);
  }

  console.log(`\nInitialized ELO ratings for ${teams.length} teams.`);
  console.log('ELO initialization completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during ELO initialization:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
