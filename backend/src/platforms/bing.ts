import axios from 'axios';
import { insertBingSnapshot } from '../db/queries/bing';
import type { BingCredentials, TrackedItem } from '../types';

const BING_API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

export async function collectBing(item: TrackedItem, credentials: BingCredentials): Promise<boolean> {
  const siteUrl = credentials.siteUrl;
  if (!siteUrl) {
    console.error('[Bing] Missing siteUrl in credentials');
    return false;
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const response = await axios.get(`${BING_API_BASE}/GetPageStats`, {
      params: {
        apikey: credentials.apiKey,
        siteUrl,
        page: item.platform_identifier,
      },
    });

    const stats = response.data?.d ?? response.data;

    // Aggregate stats over the response entries (array of daily stats)
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalRank = 0;
    let rankCount = 0;

    const entries = Array.isArray(stats) ? stats : [stats];
    for (const entry of entries) {
      totalImpressions += entry.Impressions ?? 0;
      totalClicks += entry.Clicks ?? 0;
      if (entry.AvgImpressionPosition != null) {
        totalRank += entry.AvgImpressionPosition;
        rankCount++;
      }
    }

    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : null;
    const avgRank = rankCount > 0 ? totalRank / rankCount : null;

    insertBingSnapshot({
      tracked_item_id: item.id,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr,
      avg_rank: avgRank,
      date_range_start: fmt(sevenDaysAgo),
      date_range_end: fmt(now),
    });

    console.log(`[Bing] Collected snapshot for ${item.platform_identifier}`);
    return true;
  } catch (err: any) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      console.error(`[Bing] Auth failed for ${siteUrl}: ${status}`);
    } else {
      console.error(`[Bing] Failed to collect ${item.platform_identifier}: ${err.message}`);
    }
    return false;
  }
}
