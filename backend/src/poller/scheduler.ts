import cron from 'node-cron';
import { getDueAccounts, getActiveTrackedItems, updatePollSuccess, updatePollFailure } from '../db/queries/accounts';
import { decryptCredentials } from '../crypto/credentials';
import { collectGithub } from '../platforms/github';
import { collectReddit } from '../platforms/reddit';
import { collectGA4 } from '../platforms/ga4';
import { collectBing } from '../platforms/bing';
import type { GithubCredentials, RedditCredentials, GA4Credentials, BingCredentials } from '../types';

async function pollAccount(account: ReturnType<typeof getDueAccounts>[0]): Promise<void> {
  const items = getActiveTrackedItems(account.id);
  if (items.length === 0) return;

  let credentials: any;
  try {
    credentials = decryptCredentials(account.credentials);
  } catch (err: any) {
    console.error(`[Scheduler] Failed to decrypt credentials for account ${account.id} (${account.display_name}): ${err.message}`);
    updatePollFailure(account.id);
    return;
  }

  let allSuccess = true;

  for (const item of items) {
    try {
      let success = false;

      switch (account.platform) {
        case 'github':
          success = await collectGithub(item, credentials as GithubCredentials);
          break;
        case 'reddit':
          success = await collectReddit(item, credentials as RedditCredentials);
          break;
        case 'ga4':
          success = await collectGA4(item, credentials as GA4Credentials);
          break;
        case 'bing':
          success = await collectBing(item, credentials as BingCredentials);
          break;
        default:
          console.error(`[Scheduler] Unknown platform: ${account.platform}`);
          success = false;
      }

      if (!success) allSuccess = false;
    } catch (err: any) {
      console.error(`[Scheduler] Uncaught error collecting ${item.platform_identifier}: ${err.message}`);
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

  console.log('[Scheduler] Started — polling every minute, daily rollup at 23:55');
}
