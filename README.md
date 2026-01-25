# NBA Predictions

A personal NBA sports betting predictions website with ELO-based game predictions, odds comparison, and bet tracking.

## Features

- **Game Predictions**: ELO/regression-based win probability predictions with detailed factor breakdowns
- **Value Bet Detection**: Identifies +EV opportunities when model disagrees with Vegas lines
- **Odds Comparison**: Best available odds from major sportsbooks
- **Bet Tracking**: Log and track your bets with automatic settlement
- **Analytics Dashboard**: Track model accuracy and personal betting performance
- **Team Statistics**: Comprehensive stats including ATS records and trends

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js
- **Data**: balldontlie.io API, The Odds API

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- API keys for The Odds API

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Fill in your database URL and API keys.

4. Set up the database:
   ```bash
   npx prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Login/register pages
│   ├── (dashboard)/       # Main app pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── games/            # Game-related components
│   ├── predictions/      # Prediction components
│   ├── bets/             # Bet tracking components
│   └── analytics/        # Charts and analytics
├── lib/
│   ├── api/              # External API clients
│   ├── predictions/      # Prediction algorithm
│   └── utils/            # Utility functions
├── hooks/                 # React hooks
└── types/                 # TypeScript types
```

## Prediction Model

The prediction algorithm uses:

1. **ELO Ratings** (40% weight) - Updated after each game
2. **Recent Form** (20%) - Last 10 games weighted
3. **Home Court Advantage** (15%) - Dynamic per-team calculation
4. **Rest Advantage** (10%) - Back-to-back detection
5. **Head-to-Head** (5%) - Season matchup history
6. **Travel Distance** (5%) - Cross-country penalties
7. **Injuries** (5%) - Manual injury flags

## Disclaimer

This website is for informational and entertainment purposes only. Predictions are based on statistical models and do not guarantee results. Sports betting involves risk. Please gamble responsibly.

## License

MIT
