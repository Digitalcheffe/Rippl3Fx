import db from '../db/connection';

interface MetricConfig {
  metric_name: string;
  calc_type: 'delta' | 'incremental';
  lane: 'reach' | 'interest' | 'engagement';
}

interface LaneValues {
  reach: number;
  interest: number;
  engagement: number;
}

/** Get metric config for a platform. Cached after first load. */
const configCache: Record<string, MetricConfig[]> = {};
export function getMetricConfig(platform: string): MetricConfig[] {
  if (configCache[platform]) return configCache[platform];
  const rows = db.prepare('SELECT metric_name, calc_type, lane FROM metric_config WHERE platform = ?').all(platform) as MetricConfig[];
  configCache[platform] = rows;
  return rows;
}

/**
 * Get previous cumulative value for a metric.
 * @param trackedItemId - null for account-level, number for per-item tracking
 */
function getPrevious(accountId: number, metricName: string, trackedItemId: number | null = null): number {
  const itemId = trackedItemId ?? 0; // 0 = account-level
  const row = db.prepare(
    'SELECT previous_value FROM metric_previous WHERE metric_account_id = ? AND tracked_item_id = ? AND metric_name = ?'
  ).get(accountId, itemId, metricName) as { previous_value: number } | undefined;
  return row?.previous_value ?? 0;
}

/**
 * Store current cumulative value as previous for next delta calculation.
 * @param trackedItemId - null/0 for account-level, number for per-item tracking
 */
function setPrevious(accountId: number, metricName: string, value: number, trackedItemId: number | null = null): void {
  const itemId = trackedItemId ?? 0; // 0 = account-level
  db.prepare(`
    INSERT INTO metric_previous (metric_account_id, tracked_item_id, metric_name, previous_value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(metric_account_id, tracked_item_id, metric_name) DO UPDATE SET
      previous_value = excluded.previous_value, updated_at = CURRENT_TIMESTAMP
  `).run(accountId, itemId, metricName, value);
}

/**
 * Calculate lane values from raw metrics using metric_config.
 * For 'delta' metrics: computes change from previous stored value and updates previous.
 * For 'incremental' metrics: uses raw value directly.
 * @param trackedItemId - null for account-level, number for per-item tracking
 */
export function calcLanesFromRaw(
  accountId: number,
  platform: string,
  rawMetrics: Record<string, number>,
  updatePrevious: boolean = true,
  trackedItemId: number | null = null,
): LaneValues {
  const config = getMetricConfig(platform);
  const lanes: LaneValues = { reach: 0, interest: 0, engagement: 0 };

  for (const cfg of config) {
    const rawValue = rawMetrics[cfg.metric_name] ?? 0;
    let value: number;

    if (cfg.calc_type === 'delta') {
      const prev = getPrevious(accountId, cfg.metric_name, trackedItemId);
      // Delta = current - previous. If no previous (first time), delta = 0 (baseline).
      value = prev > 0 ? Math.max(0, rawValue - prev) : 0;
      if (updatePrevious) {
        setPrevious(accountId, cfg.metric_name, rawValue, trackedItemId);
      }
    } else {
      // Incremental — use raw value directly
      value = rawValue;
    }

    lanes[cfg.lane] += value;
  }

  return lanes;
}

/**
 * Set baseline cumulative values for delta tracking (called after backfill).
 * @param trackedItemId - null for account-level, number for per-item tracking
 */
export function setPreviousBaseline(accountId: number, metrics: Record<string, number>, trackedItemId: number | null = null): void {
  for (const [name, value] of Object.entries(metrics)) {
    setPrevious(accountId, name, value, trackedItemId);
  }
}

/**
 * Calculate lane values for backfill — no delta tracking, just use raw values.
 * Used when we have per-day data already (traffic views per day, etc.)
 * For delta metrics during backfill, we pass pre-calculated daily values.
 */
export function calcLanesFromDaily(
  platform: string,
  dailyMetrics: Record<string, number>,
): LaneValues {
  const config = getMetricConfig(platform);
  const lanes: LaneValues = { reach: 0, interest: 0, engagement: 0 };

  for (const cfg of config) {
    const value = dailyMetrics[cfg.metric_name] ?? 0;
    lanes[cfg.lane] += value;
  }

  return lanes;
}
