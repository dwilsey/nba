# NBA Predictions Site - API Integration PRD

## Overview

This plan addresses the key issues with the NBA Predictions site:
1. **All UI pages use mock/hardcoded data** instead of real API calls
2. **Only historical games display** - upcoming games are filtered out
3. **Season is hardcoded** to 2024
4. **Missing API key configuration** for balldontlie and backup APIs

---

## Current State Analysis

### Mock Data Usage (All Pages)
| File | Component | Issue |
|------|-----------|-------|
| `src/components/games/TodaysGames.tsx` | Today's Games | Uses `mockGames` array |
| `src/app/(dashboard)/games/page.tsx` | Games Page | Uses `mockGames` array |
| `src/app/(dashboard)/stats/page.tsx` | Team Stats | Uses `mockTeams` (4 teams only) |
| `src/app/(dashboard)/odds/page.tsx` | Odds Page | Uses `mockOdds` array |
| `src/app/(dashboard)/predictions/page.tsx` | Predictions | Uses `mockModelStats` |
| `src/app/(dashboard)/my-bets/page.tsx` | My Bets | Uses `mockBets` + `mockStats` |

### Root Cause - Historical Games Only
- `src/lib/api/balldontlie.ts` line ~205: `filter((game) => game.status === 'Final')`
- Only returns completed games, excludes scheduled/upcoming

### API Keys Status
- ODDS_API_KEY - Already configured in `.env`
- BALLDONTLIE_API_KEY - **Missing** (needs to be added)
- BACKUP_NBA_API_KEY - **Missing** (needs to be added)

---

## Implementation Plan

### Phase 1: Environment Configuration
**File:** `/.env`

Add missing API keys:
```
BALLDONTLIE_API_KEY="035e95fd-e475-46f2-8ae5-15dd985d85e3"
BACKUP_NBA_API_KEY="6d5595651fmsh9d36e066d252ab3p1d561cjsn3baf73115612"
```

Update API clients to use these keys in headers where needed.

---

### Phase 2: Fix Game Status Filtering

**File:** `src/lib/api/balldontlie.ts`

1. Keep `getTeamRecentGames()` filtering for `Final` (needed for historical stats)
2. Add new method `getUpcomingGames()` for scheduled games
3. Modify `getGames()` to return ALL games (scheduled, in-progress, final)

```typescript
// NEW: Get upcoming/scheduled games
async getUpcomingGames(days: number = 7): Promise<Game[]> {
  const today = new Date();
  const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  const response = await this.getGames({
    startDate: today.toISOString().split('T')[0],
    endDate: futureDate.toISOString().split('T')[0],
  });

  return response.data.filter((game) => game.status !== 'Final');
}
```

---

### Phase 3: Dynamic Season Detection

**Create:** `src/lib/utils/season.ts`

```typescript
export function getCurrentNBASeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  // Oct-Dec = current year, Jan-June = previous year
  if (month >= 9) return year;      // October-December
  if (month <= 5) return year - 1;  // January-June
  return year;                       // July-September (off-season)
}

export function formatSeasonDisplay(season: number): string {
  return `${season}-${String(season + 1).slice(-2)}`; // "2024-25"
}
```

Update all hardcoded `'2024'` references to use `getCurrentNBASeason()`.

---

### Phase 4: Create Missing SWR Hooks

**Create:** `src/hooks/useTeams.ts`
- Fetches from `/api/stats/teams`
- Supports conference filtering
- 5-minute cache

**Create:** `src/hooks/useOdds.ts`
- Fetches from `/api/odds`
- 5-minute cache (conserve API quota)

**Create:** `src/hooks/usePredictions.ts`
- `usePredictions(date?)` - Get predictions for date
- `usePredictionAccuracy()` - Get model accuracy stats

**Update:** `src/hooks/index.ts` - Export all hooks

---

### Phase 5: Replace Mock Data with Real API Calls

#### 5.1 TodaysGames Component
**File:** `src/components/games/TodaysGames.tsx`

- Remove `mockGames` array
- Import `useTodaysGames` from hooks
- Add loading/error states
- Transform API response to GameCard format

#### 5.2 Games Page
**File:** `src/app/(dashboard)/games/page.tsx`

- Remove `mockGames` array
- Use `useGames(selectedDate)` hook
- Add date picker for browsing dates
- Handle loading/error states

#### 5.3 Stats Page
**File:** `src/app/(dashboard)/stats/page.tsx`

- Remove `mockTeams` array (currently only 4 teams)
- Use `useTeams(conference)` hook
- Display all 30 NBA teams with real stats

#### 5.4 Odds Page
**File:** `src/app/(dashboard)/odds/page.tsx`

- Remove `mockOdds` array
- Use `useOdds()` hook
- Display real odds from The Odds API

#### 5.5 Predictions Page
**File:** `src/app/(dashboard)/predictions/page.tsx`

- Remove `mockModelStats`
- Use `usePredictionAccuracy()` hook
- Show real model performance data

#### 5.6 My Bets Page
**File:** `src/app/(dashboard)/my-bets/page.tsx`

- Remove `mockBets` and `mockStats`
- Use existing `useBets()` hook
- Add `useAnalytics()` for betting stats

---

### Phase 6: Add Reusable Loading/Error Component

**Create:** `src/components/ui/DataState.tsx`

Handles loading spinner, error message with retry, and empty state consistently across all pages.

---

### Phase 7: API Route Enhancements

#### 7.1 Update Stats Teams Route
**File:** `src/app/api/stats/teams/route.ts`

- Ensure it fetches all 30 teams
- Include win/loss records, streaks, ATS data
- Support conference filtering

#### 7.2 Verify Prediction Accuracy Route
**File:** `src/app/api/predictions/accuracy/route.ts`

- Calculate overall accuracy
- ROI metrics
- By-month breakdown

---

## Files to Modify (Summary)

### New Files
- `src/lib/utils/season.ts` - Season detection utility
- `src/hooks/useTeams.ts` - Teams data hook
- `src/hooks/useOdds.ts` - Odds data hook
- `src/hooks/usePredictions.ts` - Predictions hook
- `src/components/ui/DataState.tsx` - Loading/error component

### Modified Files
- `.env` - Add missing API keys
- `src/lib/api/balldontlie.ts` - Add upcoming games method
- `src/hooks/index.ts` - Export new hooks
- `src/components/games/TodaysGames.tsx` - Use real API
- `src/app/(dashboard)/games/page.tsx` - Use real API
- `src/app/(dashboard)/stats/page.tsx` - Use real API
- `src/app/(dashboard)/odds/page.tsx` - Use real API
- `src/app/(dashboard)/predictions/page.tsx` - Use real API
- `src/app/(dashboard)/my-bets/page.tsx` - Use real API

---

## Verification Plan

1. **Environment Setup**
   - Verify all API keys are configured in `.env`
   - Test each API endpoint manually with curl

2. **API Integration**
   - Run `npm run dev` and check browser console for API errors
   - Verify `/api/games/today` returns real data
   - Verify `/api/odds` returns real odds
   - Verify `/api/stats/teams` returns all 30 teams

3. **UI Testing**
   - Home page shows today's real games
   - Games page displays games with date picker
   - Stats page shows all 30 teams with real records
   - Odds page shows current odds from bookmakers
   - Predictions page shows real accuracy metrics

4. **Season Detection**
   - Verify current season displays as "2024-25"
   - Verify games show for current season dates

---

## Notes

- The Odds API has rate limits - 15-minute cache is appropriate
- balldontlie.io may require authentication header
- Backup API key is for RapidAPI (failover source)
- Keep mock data commented out initially for fallback testing
