import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { fetchAllInjuries, mergeInjuries, type InjuryData } from '@/lib/data/sources/injuries';
import { createESPNInjuriesSource, createCBSInjuriesSource } from '@/lib/data/sources/injuries';
import { createBBRefInjuriesSource } from '@/lib/data/sources/basketball-ref';
import { dataFetcher } from '@/lib/data/fetcher';

/**
 * Sync injury data from multiple sources
 * Runs every 2 hours
 * Only tracks OUT and DOUBTFUL statuses
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Injuries Cron] Starting injury sync...');

    // Try to fetch injuries from multiple sources with retry logic
    const sources = [
      createESPNInjuriesSource(),
      createCBSInjuriesSource(),
      createBBRefInjuriesSource(),
    ];

    const results: InjuryData[] = [];
    const sourceResults: { source: string; count: number; error?: string }[] = [];

    // Try each source, collecting results
    for (const source of sources) {
      try {
        const result = await dataFetcher.fetchWithTimeout(source, 'Injuries', 30000);

        // Handle different source response types
        const injuries = 'injuries' in result.data
          ? (result.data as { injuries: InjuryData[] }).injuries
          : [];

        // Filter to only OUT and DOUBTFUL
        const relevantInjuries = injuries.filter((i: InjuryData) =>
          i.status === 'OUT' || i.status === 'DOUBTFUL'
        );

        results.push(...relevantInjuries);
        sourceResults.push({
          source: result.source,
          count: relevantInjuries.length,
        });

        console.log(`[Injuries Cron] ${result.source}: ${relevantInjuries.length} injuries`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        sourceResults.push({
          source: source.name,
          count: 0,
          error: errorMsg,
        });
        console.log(`[Injuries Cron] ${source.name} failed: ${errorMsg}`);
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        message: 'No injuries fetched from any source',
        sources: sourceResults,
      });
    }

    // Deduplicate by player ID
    const uniqueInjuries = new Map<number, InjuryData>();
    for (const injury of results) {
      const existing = uniqueInjuries.get(injury.playerId);
      // Keep OUT over DOUBTFUL if duplicate
      if (!existing || (injury.status === 'OUT' && existing.status === 'DOUBTFUL')) {
        uniqueInjuries.set(injury.playerId, injury);
      }
    }

    const injuriesToStore = Array.from(uniqueInjuries.values());
    console.log(`[Injuries Cron] ${injuriesToStore.length} unique injuries to store`);

    // Store in database
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const injury of injuriesToStore) {
      try {
        // Check if we already have this injury
        const existing = await prisma.injuryReport.findFirst({
          where: {
            playerId: injury.playerId,
          },
          orderBy: { fetchedAt: 'desc' },
        });

        // Only create new record if status changed or doesn't exist
        if (!existing || existing.status !== injury.status || existing.injury !== injury.injury) {
          await prisma.injuryReport.create({
            data: {
              playerId: injury.playerId,
              playerName: injury.playerName,
              teamId: injury.teamId,
              teamName: injury.teamName,
              status: injury.status,
              injury: injury.injury,
              returnDate: injury.returnDate,
              source: injury.source,
              impactLevel: injury.impactLevel,
            },
          });

          if (existing) {
            updated++;
          } else {
            created++;
          }
        }
      } catch (error) {
        console.error(`[Injuries Cron] Error storing injury for ${injury.playerName}:`, error);
        errors++;
      }
    }

    // Also update the legacy InjuryFlag table for backward compatibility
    await updateLegacyInjuryFlags(injuriesToStore);

    return NextResponse.json({
      message: `Injury sync complete`,
      created,
      updated,
      errors,
      totalInjuries: injuriesToStore.length,
      sources: sourceResults,
      highImpact: injuriesToStore.filter(i => i.impactLevel === 'HIGH').length,
    });
  } catch (error) {
    console.error('[Injuries Cron] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync injuries' },
      { status: 500 }
    );
  }
}

/**
 * Update legacy InjuryFlag table
 */
async function updateLegacyInjuryFlags(injuries: InjuryData[]) {
  for (const injury of injuries) {
    try {
      // Map impactLevel to legacy impact field
      const impact = injury.impactLevel.toLowerCase();

      // Check if flag exists
      const existing = await prisma.injuryFlag.findFirst({
        where: {
          playerId: injury.playerId,
          clearedAt: null,
        },
      });

      if (!existing) {
        await prisma.injuryFlag.create({
          data: {
            playerId: injury.playerId,
            playerName: injury.playerName,
            teamId: String(injury.teamId),
            status: injury.status.toLowerCase(),
            impact,
            notes: injury.injury,
            flaggedBy: injury.source,
          },
        });
      } else if (existing.status !== injury.status.toLowerCase()) {
        await prisma.injuryFlag.update({
          where: { id: existing.id },
          data: {
            status: injury.status.toLowerCase(),
            notes: injury.injury,
          },
        });
      }
    } catch (error) {
      // Silently continue - legacy table is optional
    }
  }
}

/**
 * GET endpoint to fetch current injuries
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamAbbr = searchParams.get('team');
    const statusFilter = searchParams.get('status'); // OUT, DOUBTFUL, or all

    const where: Record<string, unknown> = {};

    if (teamAbbr) {
      where.teamName = teamAbbr.toUpperCase();
    }

    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter.toUpperCase();
    }

    // Get most recent injury for each player
    const injuries = await prisma.injuryReport.findMany({
      where,
      orderBy: { fetchedAt: 'desc' },
      distinct: ['playerId'],
    });

    // Group by team
    const byTeam = injuries.reduce((acc, injury) => {
      const team = injury.teamName;
      if (!acc[team]) acc[team] = [];
      acc[team].push(injury);
      return acc;
    }, {} as Record<string, typeof injuries>);

    // Summary stats
    const summary = {
      total: injuries.length,
      out: injuries.filter(i => i.status === 'OUT').length,
      doubtful: injuries.filter(i => i.status === 'DOUBTFUL').length,
      highImpact: injuries.filter(i => i.impactLevel === 'HIGH').length,
    };

    return NextResponse.json({
      summary,
      injuries,
      byTeam,
    });
  } catch (error) {
    console.error('[Injuries] Error fetching:', error);
    return NextResponse.json(
      { error: 'Failed to fetch injuries' },
      { status: 500 }
    );
  }
}
