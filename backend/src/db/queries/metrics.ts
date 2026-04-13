import db from '../connection';

const SNAPSHOT_TABLES: Record<string, string> = {
  github: 'github_snapshots',
  reddit: 'reddit_snapshots',
  ga4:    'ga4_snapshots',
  bing:   'bing_snapshots',
};

const DAILY_TABLES: Record<string, string> = {
  github: 'github_daily',
  reddit: 'reddit_daily',
  ga4:    'ga4_daily',
  bing:   'bing_daily',
};

const WEEKLY_TABLES: Record<string, string> = {
  github: 'github_weekly',
  reddit: 'reddit_weekly',
  ga4:    'ga4_weekly',
  bing:   'bing_weekly',
};

const MONTHLY_TABLES: Record<string, string> = {
  github: 'github_monthly',
  reddit: 'reddit_monthly',
  ga4:    'ga4_monthly',
  bing:   'bing_monthly',
};

const RANGE_TABLES: Record<string, Record<string, string>> = {
  hourly: SNAPSHOT_TABLES,
  daily: DAILY_TABLES,
  weekly: WEEKLY_TABLES,
  monthly: MONTHLY_TABLES,
};

export interface DashboardItem {
  id: number;
  platform: string;
  display_name: string;
  platform_identifier: string;
  tags: string[];
  latestSnapshot: Record<string, any> | null;
  interestHistory: number[];
  currentInterestScore: number;
  interestTrend: 'up' | 'down' | 'flat';
}

export function getLatestSnapshot(trackedItemId: number, platform: string): Record<string, any> | null {
  const table = SNAPSHOT_TABLES[platform];
  if (!table) return null;
  const row = db.prepare(
    `SELECT * FROM ${table} WHERE tracked_item_id = ? ORDER BY collected_at DESC LIMIT 1`
  ).get(trackedItemId) as Record<string, any> | undefined;
  return row ?? null;
}

/** Get the latest row from a range-specific table (daily, weekly, monthly, or hourly). */
export function getLatestForRange(trackedItemId: number, platform: string, range: string): Record<string, any> | null {
  const tables = RANGE_TABLES[range];
  if (!tables) return null;
  const table = tables[platform];
  if (!table) return null;
  const dateCol = range === 'hourly' ? 'collected_at' : 'period_start';
  const row = db.prepare(
    `SELECT * FROM ${table} WHERE tracked_item_id = ? ORDER BY ${dateCol} DESC LIMIT 1`
  ).get(trackedItemId) as Record<string, any> | undefined;
  return row ?? null;
}

/** Get the two most recent rows from a range-specific table for velocity. */
export function getRangePair(trackedItemId: number, platform: string, range: string): { today: Record<string, any> | null; yesterday: Record<string, any> | null } {
  const tables = RANGE_TABLES[range];
  if (!tables) return { today: null, yesterday: null };
  const table = tables[platform];
  if (!table) return { today: null, yesterday: null };
  const dateCol = range === 'hourly' ? 'collected_at' : 'period_start';
  const rows = db.prepare(
    `SELECT * FROM ${table} WHERE tracked_item_id = ? ORDER BY ${dateCol} DESC LIMIT 2`
  ).all(trackedItemId) as Record<string, any>[];
  return { today: rows[0] ?? null, yesterday: rows[1] ?? null };
}

/** Get the most recent daily row (yesterday or earlier) for velocity comparison. */
export function getPreviousDaily(trackedItemId: number, platform: string): Record<string, any> | null {
  const table = DAILY_TABLES[platform];
  if (!table) return null;
  const row = db.prepare(
    `SELECT * FROM ${table} WHERE tracked_item_id = ? ORDER BY period_start DESC LIMIT 1`
  ).get(trackedItemId) as Record<string, any> | undefined;
  return row ?? null;
}

/** Get the second-most-recent daily row for day-over-day delta. */
export function getPreviousDailyPair(trackedItemId: number, platform: string): { today: Record<string, any> | null; yesterday: Record<string, any> | null } {
  const table = DAILY_TABLES[platform];
  if (!table) return { today: null, yesterday: null };
  const rows = db.prepare(
    `SELECT * FROM ${table} WHERE tracked_item_id = ? ORDER BY period_start DESC LIMIT 2`
  ).all(trackedItemId) as Record<string, any>[];
  return { today: rows[0] ?? null, yesterday: rows[1] ?? null };
}

export function getInterestHistory(trackedItemId: number, platform: string, days: number = 7, range: string = 'daily'): number[] {
  const rangeTables = RANGE_TABLES[range] || DAILY_TABLES;
  const table = rangeTables[platform];
  if (!table) return new Array(days).fill(0);

  // For hourly (snapshots), use collected_at; for rollups, use period_start
  const dateCol = range === 'hourly' ? 'collected_at' : 'period_start';
  const scoreCol = range === 'hourly' ? '1' : 'interest_score'; // snapshots don't have interest_score

  const rows = db.prepare(
    `SELECT ${scoreCol} as interest_score FROM ${table}
     WHERE tracked_item_id = ?
     ORDER BY ${dateCol} DESC
     LIMIT ?`
  ).all(trackedItemId, days) as Array<{ interest_score: number }>;

  // If no daily rollups yet, build history from snapshot counts per day
  if (rows.length === 0) {
    const snapshotTable = SNAPSHOT_TABLES[platform];
    if (snapshotTable) {
      const snapRows = db.prepare(
        `SELECT DATE(collected_at) as day, COUNT(*) as cnt
         FROM ${snapshotTable}
         WHERE tracked_item_id = ?
         GROUP BY DATE(collected_at)
         ORDER BY day DESC
         LIMIT ?`
      ).all(trackedItemId, days) as Array<{ day: string; cnt: number }>;

      if (snapRows.length > 0) {
        // Use snapshot existence as a basic activity signal (scale to 0-100)
        const maxCnt = Math.max(...snapRows.map(r => r.cnt), 1);
        const scores = snapRows.map(r => Math.round((r.cnt / maxCnt) * 100)).reverse();
        while (scores.length < days) scores.unshift(0);
        return scores;
      }
    }
  }

  // Reverse to oldest-first, pad with 0s to always return `days` values
  const scores = rows.map(r => r.interest_score).reverse();
  while (scores.length < days) {
    scores.unshift(0);
  }
  return scores;
}

/** Get 7-day history for a specific lane (reach, interest, or engagement). */
export function getLaneHistory(trackedItemId: number, platform: string, lane: 'reach' | 'interest' | 'engagement', days: number = 7, range: string = 'daily'): number[] {
  const rangeTables = RANGE_TABLES[range] || DAILY_TABLES;
  const table = rangeTables[platform];
  if (!table) return new Array(days).fill(0);

  const dateCol = range === 'hourly' ? 'collected_at' : 'period_start';
  const scoreCol = range === 'hourly' ? '0' : `${lane}_score`;

  const rows = db.prepare(
    `SELECT ${scoreCol} as score FROM ${table}
     WHERE tracked_item_id = ?
     ORDER BY ${dateCol} DESC
     LIMIT ?`
  ).all(trackedItemId, days) as Array<{ score: number }>;

  const scores = rows.map(r => r.score ?? 0).reverse();
  while (scores.length < days) scores.unshift(0);
  return scores;
}

export function getTrackedItemsWithPlatform(tagName?: string) {
  let query = `
    SELECT ti.id, ti.platform_identifier, ti.display_name, ti.is_active,
           ma.platform
    FROM tracked_items ti
    JOIN metric_accounts ma ON ti.metric_account_id = ma.id
    WHERE ti.is_active = 1
  `;
  const params: any[] = [];

  if (tagName) {
    query += `
      AND ti.id IN (
        SELECT it.tracked_item_id FROM item_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE t.name = ?
      )
    `;
    params.push(tagName);
  }

  query += ' ORDER BY ti.created_at DESC';
  return db.prepare(query).all(...params) as Array<{
    id: number;
    platform_identifier: string;
    display_name: string;
    is_active: number;
    platform: string;
  }>;
}

export function getTagsForItem(itemId: number): string[] {
  const rows = db.prepare(`
    SELECT t.name FROM tags t
    JOIN item_tags it ON it.tag_id = t.id
    WHERE it.tracked_item_id = ?
    ORDER BY t.name
  `).all(itemId) as Array<{ name: string }>;
  return rows.map(r => r.name);
}
