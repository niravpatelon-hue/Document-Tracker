/**
 * OCR metering (ARCHITECTURE.md §7). Every extraction increments the per-user,
 * per-month counter — from day one, while the app is still fully free — so the
 * free/paid boundary later is just a quota check. The server-side counter is
 * authoritative; this mirror supports offline display and a client-side
 * pre-check before attempting a cloud call.
 */
import { Q } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import type { ExtractionMode } from './types';
import type { OcrUsage } from '../db/models';

export const DEFAULT_FREE_CLOUD_SCANS_PER_MONTH = 20;

/** Month bucket key, e.g. "2026-07", in UTC. */
export function monthKey(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

export interface UsageSnapshot {
  scansCloud: number;
  planTier: 'free' | 'paid';
}

/** Whether a cloud (paid-cost) extraction is allowed for this user right now. */
export function canUseCloud(
  usage: UsageSnapshot,
  freeQuota: number = DEFAULT_FREE_CLOUD_SCANS_PER_MONTH,
): boolean {
  return usage.planTier === 'paid' || usage.scansCloud < freeQuota;
}

/** Increment the current month's usage row for a user, creating it if needed. */
export async function recordScan(
  database: Database,
  ownerId: string,
  mode: ExtractionMode,
  now: Date = new Date(),
): Promise<void> {
  const month = monthKey(now);
  const collection = database.get<OcrUsage>('ocr_usage');
  const existing = await collection
    .query(Q.where('owner_id', ownerId), Q.where('month', month))
    .fetch();

  await database.write(async () => {
    const first = existing[0];
    if (!first) {
      await collection.create((row) => {
        row.ownerId = ownerId;
        row.month = month;
        row.scansOnDevice = mode === 'on_device' ? 1 : 0;
        row.scansCloud = mode === 'cloud' ? 1 : 0;
        row.planTier = 'free';
      });
    } else {
      await first.update((row) => {
        if (mode === 'on_device') {
          row.scansOnDevice += 1;
        } else {
          row.scansCloud += 1;
        }
      });
    }
  });
}
