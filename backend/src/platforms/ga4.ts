import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { insertGA4Snapshot } from '../db/queries/ga4';
import type { GA4Credentials, TrackedItem } from '../types';

export async function collectGA4(item: TrackedItem, credentials: GA4Credentials): Promise<{ success: boolean; error?: string }> {
  const propertyId = item.platform_identifier;
  if (!propertyId) {
    return { success: false, error: 'Missing property ID in platform_identifier' };
  }

  try {
    const serviceAccount = JSON.parse(credentials.serviceAccountJson);

    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      projectId: serviceAccount.project_id,
    });

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'engagementRate' },
      ],
    });

    const row = response.rows?.[0];
    const metrics = row?.metricValues;

    // Compute actual date range
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    insertGA4Snapshot({
      tracked_item_id: item.id,
      sessions: metrics?.[0]?.value ? parseInt(metrics[0].value, 10) : null,
      pageviews: metrics?.[1]?.value ? parseInt(metrics[1].value, 10) : null,
      users: metrics?.[2]?.value ? parseInt(metrics[2].value, 10) : null,
      engagement_rate: metrics?.[3]?.value ? parseFloat(metrics[3].value) : null,
      date_range_start: fmt(sevenDaysAgo),
      date_range_end: fmt(now),
    });

    console.log(`[GA4] Collected snapshot for property ${propertyId}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[GA4] Failed to collect property ${propertyId}: ${err.message}`);
    return { success: false, error: err.message };
  }
}
