import cron from 'node-cron';
import { getDueAccounts, getActiveTrackedItems, updatePollSuccess, updatePollFailure } from '../db/queries/accounts';
import { decryptCredentials } from '../crypto/credentials';
import { collectGithub } from '../platforms/github';
import { collectReddit } from '../platforms/reddit';
import { collectGA4 } from '../platforms/ga4';
import { collectBing } from '../platforms/bing';
import { insertPollLog } from '../db/queries/logs';
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
  // Run every minute
  cron.schedule('* * * * *', () => {
    tick().catch(err => {
      console.error(`[Scheduler] Tick failed: ${err.message}`);
    });
  });

  // Daily rollup at 23:55
  cron.schedule('55 23 * * *', () => {
    try {
      const { runDailyRollup } = require('../rollup/daily');
      runDailyRollup();
    } catch (err: any) {
      console.error(`[Scheduler] Daily rollup failed: ${err.message}`);
    }
  });

  // Weekly rollup at Sunday 23:58
  cron.schedule('58 23 * * 0', () => {
    try {
      const { runWeeklyRollup } = require('../rollup/weekly');
      runWeeklyRollup();
    } catch (err: any) {
      console.error(`[Scheduler] Weekly rollup failed: ${err.message}`);
    }
  });

  // Monthly rollup at 23:59 on 28th–31st (only runs if tomorrow is a new month)
  cron.schedule('59 23 28-31 * *', () => {
    try {
      const { isTomorrowNewMonth, runMonthlyRollup } = require('../rollup/monthly');
      if (isTomorrowNewMonth()) {
        runMonthlyRollup();
      }
    } catch (err: any) {
      console.error(`[Scheduler] Monthly rollup failed: ${err.message}`);
    }
  });

  console.log('[Scheduler] Started — polling every minute, rollups at 23:55/23:58/23:59');
}
