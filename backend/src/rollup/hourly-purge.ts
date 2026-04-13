import db from '../db/connection';

/**
 * Purge hourly_metrics rows older than 48 hours.
 * MUST run AFTER daily rollup to avoid losing data before it's rolled up.
 */
export function runHourlyPurge(): void {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const result = db.prepare('DELETE FROM hourly_metrics WHERE created_at < ?').run(cutoff);
  console.log(`[Purge] Hourly purge complete — removed ${result.changes} rows older than 48hrs`);
}
