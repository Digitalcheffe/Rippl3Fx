import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { insertGA4Snapshot } from '../db/queries/ga4';
import type { GA4Credentials, TrackedItem } from '../types';

export async function collectGA4(item: TrackedItem, credentials: GA4Credentials): Promise<{ success: boolean; error?: string }> {
  const propertyId = credentials.propertyId;
  if (!propertyId) {
    return { success: false, error: 'Missing propertyId in account credentials' };
  }

  const pagePath = item.platform_identifier;

  try {
    const serviceAccount = JSON.parse(credentials.serviceAccountJson);

    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      projectId: serviceAccount.project_id,
    });

    // Build report request — filter by page path if provided
    const reportRequest: any = {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'engagementRate' },
      ],
    };

    // If platform_identifier is a page path, filter to just that page
    if (pagePath && pagePath !== propertyId && !pagePath.match(/^\d+$/)) {
      reportRequest.dimensionFilter = {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT',
            value: pagePath,
          },
        },
      };
    }

    const [response] = await client.runReport(reportRequest);

    const row = response.rows?.[0];
    const metrics = row?.metricValues;

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

    console.log(`[GA4] Collected snapshot for ${pagePath || propertyId}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[GA4] Failed to collect ${pagePath || propertyId}: ${err.message}`);
    return { success: false, error: err.message };
  }
}
