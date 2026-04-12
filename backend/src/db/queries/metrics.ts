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

export function getInterestHistory(trackedItemId: number, platform: string, days: number = 7): number[] {
  const table = DAILY_TABLES[platform];
  if (!table) return [];

  const rows = db.prepare(
    `SELECT interest_score FROM ${table}
     WHERE tracked_item_id = ?
     ORDER BY period_start DESC
     LIMIT ?`
  ).all(trackedItemId, days) as Array<{ interest_score: number }>;

  // Reverse to oldest-first, pad with 0s to always return `days` values
  const scores = rows.map(r => r.interest_score).reverse();
  while (scores.length < days) {
    scores.unshift(0);
  }
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
