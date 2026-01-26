import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// All 30 NBA teams with their balldontlie API external IDs
const NBA_TEAMS = [
  { externalId: 1, name: 'Hawks', fullName: 'Atlanta Hawks', abbreviation: 'ATL', city: 'Atlanta', conference: 'East', division: 'Southeast' },
  { externalId: 2, name: 'Celtics', fullName: 'Boston Celtics', abbreviation: 'BOS', city: 'Boston', conference: 'East', division: 'Atlantic' },
  { externalId: 3, name: 'Nets', fullName: 'Brooklyn Nets', abbreviation: 'BKN', city: 'Brooklyn', conference: 'East', division: 'Atlantic' },
  { externalId: 4, name: 'Hornets', fullName: 'Charlotte Hornets', abbreviation: 'CHA', city: 'Charlotte', conference: 'East', division: 'Southeast' },
  { externalId: 5, name: 'Bulls', fullName: 'Chicago Bulls', abbreviation: 'CHI', city: 'Chicago', conference: 'East', division: 'Central' },
  { externalId: 6, name: 'Cavaliers', fullName: 'Cleveland Cavaliers', abbreviation: 'CLE', city: 'Cleveland', conference: 'East', division: 'Central' },
  { externalId: 7, name: 'Mavericks', fullName: 'Dallas Mavericks', abbreviation: 'DAL', city: 'Dallas', conference: 'West', division: 'Southwest' },
  { externalId: 8, name: 'Nuggets', fullName: 'Denver Nuggets', abbreviation: 'DEN', city: 'Denver', conference: 'West', division: 'Northwest' },
  { externalId: 9, name: 'Pistons', fullName: 'Detroit Pistons', abbreviation: 'DET', city: 'Detroit', conference: 'East', division: 'Central' },
  { externalId: 10, name: 'Warriors', fullName: 'Golden State Warriors', abbreviation: 'GSW', city: 'Golden State', conference: 'West', division: 'Pacific' },
  { externalId: 11, name: 'Rockets', fullName: 'Houston Rockets', abbreviation: 'HOU', city: 'Houston', conference: 'West', division: 'Southwest' },
  { externalId: 12, name: 'Pacers', fullName: 'Indiana Pacers', abbreviation: 'IND', city: 'Indiana', conference: 'East', division: 'Central' },
  { externalId: 13, name: 'Clippers', fullName: 'Los Angeles Clippers', abbreviation: 'LAC', city: 'Los Angeles', conference: 'West', division: 'Pacific' },
  { externalId: 14, name: 'Lakers', fullName: 'Los Angeles Lakers', abbreviation: 'LAL', city: 'Los Angeles', conference: 'West', division: 'Pacific' },
  { externalId: 15, name: 'Grizzlies', fullName: 'Memphis Grizzlies', abbreviation: 'MEM', city: 'Memphis', conference: 'West', division: 'Southwest' },
  { externalId: 16, name: 'Heat', fullName: 'Miami Heat', abbreviation: 'MIA', city: 'Miami', conference: 'East', division: 'Southeast' },
  { externalId: 17, name: 'Bucks', fullName: 'Milwaukee Bucks', abbreviation: 'MIL', city: 'Milwaukee', conference: 'East', division: 'Central' },
  { externalId: 18, name: 'Timberwolves', fullName: 'Minnesota Timberwolves', abbreviation: 'MIN', city: 'Minnesota', conference: 'West', division: 'Northwest' },
  { externalId: 19, name: 'Pelicans', fullName: 'New Orleans Pelicans', abbreviation: 'NOP', city: 'New Orleans', conference: 'West', division: 'Southwest' },
  { externalId: 20, name: 'Knicks', fullName: 'New York Knicks', abbreviation: 'NYK', city: 'New York', conference: 'East', division: 'Atlantic' },
  { externalId: 21, name: 'Thunder', fullName: 'Oklahoma City Thunder', abbreviation: 'OKC', city: 'Oklahoma City', conference: 'West', division: 'Northwest' },
  { externalId: 22, name: 'Magic', fullName: 'Orlando Magic', abbreviation: 'ORL', city: 'Orlando', conference: 'East', division: 'Southeast' },
  { externalId: 23, name: '76ers', fullName: 'Philadelphia 76ers', abbreviation: 'PHI', city: 'Philadelphia', conference: 'East', division: 'Atlantic' },
  { externalId: 24, name: 'Suns', fullName: 'Phoenix Suns', abbreviation: 'PHX', city: 'Phoenix', conference: 'West', division: 'Pacific' },
  { externalId: 25, name: 'Trail Blazers', fullName: 'Portland Trail Blazers', abbreviation: 'POR', city: 'Portland', conference: 'West', division: 'Northwest' },
  { externalId: 26, name: 'Kings', fullName: 'Sacramento Kings', abbreviation: 'SAC', city: 'Sacramento', conference: 'West', division: 'Pacific' },
  { externalId: 27, name: 'Spurs', fullName: 'San Antonio Spurs', abbreviation: 'SAS', city: 'San Antonio', conference: 'West', division: 'Southwest' },
  { externalId: 28, name: 'Raptors', fullName: 'Toronto Raptors', abbreviation: 'TOR', city: 'Toronto', conference: 'East', division: 'Atlantic' },
  { externalId: 29, name: 'Jazz', fullName: 'Utah Jazz', abbreviation: 'UTA', city: 'Utah', conference: 'West', division: 'Northwest' },
  { externalId: 30, name: 'Wizards', fullName: 'Washington Wizards', abbreviation: 'WAS', city: 'Washington', conference: 'East', division: 'Southeast' },
];

// Get current NBA season
function getCurrentNBASeason(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  if (month >= 9) return year;
  if (month <= 5) return year - 1;
  return year;
}

async function main() {
  console.log('Starting database seed...');

  const currentSeason = getCurrentNBASeason();
  console.log(`Current NBA season: ${currentSeason}-${currentSeason + 1}`);

  // Seed teams
  console.log('Seeding 30 NBA teams...');

  for (const teamData of NBA_TEAMS) {
    const team = await prisma.team.upsert({
      where: { externalId: teamData.externalId },
      update: {
        name: teamData.name,
        fullName: teamData.fullName,
        abbreviation: teamData.abbreviation,
        city: teamData.city,
        conference: teamData.conference,
        division: teamData.division,
      },
      create: {
        externalId: teamData.externalId,
        name: teamData.name,
        fullName: teamData.fullName,
        abbreviation: teamData.abbreviation,
        city: teamData.city,
        conference: teamData.conference,
        division: teamData.division,
      },
    });

    // Create empty stats for each team if not exists
    await prisma.teamStats.upsert({
      where: { teamId: team.id },
      update: {
        season: currentSeason,
      },
      create: {
        teamId: team.id,
        season: currentSeason,
        wins: 0,
        losses: 0,
        homeWins: 0,
        homeLosses: 0,
        awayWins: 0,
        awayLosses: 0,
        pointsPerGame: 0,
        pointsAgainst: 0,
        streak: 0,
        last10Wins: 0,
        last10Losses: 0,
        atsWins: 0,
        atsLosses: 0,
        atsPushes: 0,
      },
    });

    console.log(`  - ${teamData.fullName}`);
  }

  console.log(`\nSeeded ${NBA_TEAMS.length} teams with initial stats.`);
  console.log('\nDatabase seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
