import { useEffect, useState } from 'react';
import type { Model, Query } from '@nozbe/watermelondb';

/**
 * Subscribe to a WatermelonDB query and re-render on any change. Because the
 * local DB is the source of truth, screens observe it directly and update
 * live — no manual refetch after a write.
 *
 * `deps` should list the values the query is built from so the subscription is
 * rebuilt when they change.
 */
export function useQuery<T extends Model>(makeQuery: () => Query<T>, deps: unknown[] = []): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    const subscription = makeQuery().observe().subscribe(setRows);
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rows;
}
