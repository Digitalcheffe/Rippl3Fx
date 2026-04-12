import cron from 'node-cron';
import { getDueAccounts, getActiveTrackedItems, updatePollSuccess, updatePollFailure } from '../db/queries/accounts';
import { decryptCredentials } from '../crypto/credentials';
import { collectGithub } from '../platforms/github';
import { collectReddit } from '../platforms/reddit';
import { collectGA4 } from '../platforms/ga4';
import { collectBing } from '../platforms/bing';
import { insertPollLog } from '../db/queries/logs';
import { getTimezone } from '../utils/timezone';
import type { GithubCredentials, RedditCredentials, GA4Credentials, BingCredentials } from '../types';

async function pollAccount(account: ReturnType<typeof getDueAccounts>[0]): Promise<void> {
  const items = getActiveTrackedItems(account.id);
  if (items.length === 0) return;

  let credentials: any;
  try {
    credentials = decryptCredentials(account.credentials);
  } catch (err: any) {
    const msg = `Failed to decrypt credentials: ${err.message}`;
    console.error(`[Scheduler] ${msg}`);
    insertPollLog({ metric_account_id: account.id, platform: account.platform, level: 'error', message: msg });
    updatePollFailure(account.id);
    return;
  }

  let allSuccess = true;

  for (const item of items) {
    try {
      let result: { success: boolean; error?: string } = { success: false, error: 'Unknown platform' };

      switch (account.platform) {
        case 'github':
          result = await collectGithub(item, credentials as GithubCredentials);
          break;
        case 'reddit':
          result = await collectReddit(item, credentials as RedditCredentials);
          break;
        case 'ga4':
          result = await collectGA4(item, credentials as GA4Credentials);
          break;
        case 'bing':
          result = await collectBing(item, credentials as BingCredentials);
          break;
      }

      if (result.success) {
        insertPollLog({ metric_account_id: account.id, tracked_item_id: item.id, platform: account.platform, level: 'info', message: `Collected ${item.display_name} (${item.platform_identifier})` });
      } else {
        insertPollLog({ metric_account_id: account.id, tracked_item_id: item.id, platform: account.platform, level: 'error', message: `Failed ${item.display_name} (${item.platform_identifier}): ${result.error}` });
        allSuccess = false;
      }
    } catch (err: any) {
      const msg = `Uncaught error collecting ${item.display_name} (${item.platform_identifier}): ${err.message}`;
      console.error(`[Scheduler] ${msg}`);
      insertPollLog({ metric_account_id: account.id, tracked_item_id: item.id, platform: account.platform, level: 'error', message: msg });
      allSuccess = false;
    }
  }

  if (allSuccess) {
    updatePollSuccess(account.id, account.polling_interval_min);
  } else {
    updatePollFailure(account.id);
  }
}

async function tick(): Promise<void> {
  const accounts = getDueAccounts();
  if (accounts.length === 0) return;

  console.log(`[Scheduler] Polling ${accounts.length} account(s)`);

  for (const account of accounts) {
    try {
      await pollAccount(account);
    } catch (err: any) {
      console.error(`[Scheduler] Fatal error polling account ${account.id}: ${err.message}`);
      try {
        updatePollFailure(account.id);
      } catch {
        // Swallow — scheduler must never crash
      }
    }
  }
}

export function start(): void {
  const tz = getTimezone();
  const cronOpts = { timezone: tz };

  // Polling tick — every minute (timezone doesn't matter here)
  cron.schedule('* * * * *', () => {
    tick().catch(err => {
      console.error(`[Scheduler] Tick failed: ${err.message}`);
    });
  });

  // Daily rollup at midnight
  cron.schedule('0 0 * * *', () => {
    try {
      const { runDailyRollup } = require('../rollup/daily');
      runDailyRollup();
    } catch (err: any) {
      console.error(`[Scheduler] Daily rollup failed: ${err.message}`);
    }
  }, cronOpts);

  // Weekly rollup — Monday 00:05
  cron.schedule('5 0 * * 1', () => {
    try {
      const { runWeeklyRollup } = require('../rollup/weekly');
      runWeeklyRollup();
    } catch (err: any) {
      console.error(`[Scheduler] Weekly rollup failed: ${err.message}`);
    }
  }, cronOpts);

  // Monthly rollup — 1st of month at 00:10
  cron.schedule('10 0 1 * *', () => {
    try {
      const { runMonthlyRollup } = require('../rollup/monthly');
      runMonthlyRollup();
    } catch (err: any) {
      console.error(`[Scheduler] Monthly rollup failed: ${err.message}`);
    }
  }, cronOpts);

  // Hourly purge — 00:15 daily (after daily rollup)
  cron.schedule('15 0 * * *', () => {
    try {
      const { runHourlyPurge } = require('../rollup/hourly-purge');
      runHourlyPurge();
    } catch (err: any) {
      console.error(`[Scheduler] Hourly purge failed: ${err.message}`);
    }
  }, cronOpts);

  console.log(`[Scheduler] Started — timezone: ${tz}, rollups at midnight, polling every minute`);
}
