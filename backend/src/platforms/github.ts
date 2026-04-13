import { Octokit } from '@octokit/rest';
import { insertGithubSnapshot } from '../db/queries/github';
import type { GithubCredentials, TrackedItem } from '../types';

export async function collectGithub(item: TrackedItem, credentials: GithubCredentials): Promise<{ success: boolean; error?: string }> {
  const [owner, repo] = item.platform_identifier.split('/');
  if (!owner || !repo) {
    return { success: false, error: `Invalid platform_identifier: ${item.platform_identifier} (expected owner/repo)` };
  }

  const octokit = new Octokit({ auth: credentials.personalAccessToken });

  try {
    // Repo stats — stars, forks, open_issues, watchers (subscribers_count)
    const { data: repoData } = await octokit.repos.get({ owner, repo });

    // Traffic views (requires push access, may 403)
    let trafficViews: number | null = null;
    let trafficUniques: number | null = null;
    try {
      const { data: views } = await octokit.repos.getViews({ owner, repo, per: 'day' });
      trafficViews = views.count;
      trafficUniques = views.uniques;
    } catch (err: any) {
      console.warn(`[GitHub] Traffic views unavailable for ${item.platform_identifier}: ${err.status || err.message}`);
    }

    // Clones (requires push access, may 403)
    let cloneCount: number | null = null;
    let cloneUniques: number | null = null;
    try {
      const { data: clones } = await octokit.repos.getClones({ owner, repo, per: 'day' });
      cloneCount = clones.count;
      cloneUniques = clones.uniques;
    } catch (err: any) {
      console.warn(`[GitHub] Clones unavailable for ${item.platform_identifier}: ${err.status || err.message}`);
    }

    // Release downloads — sum all asset download_counts across all releases
    let releaseDownloads = 0;
    try {
      const { data: releases } = await octokit.repos.listReleases({ owner, repo, per_page: 100 });
      for (const release of releases) {
        for (const asset of release.assets || []) {
          releaseDownloads += asset.download_count || 0;
        }
      }
    } catch (err: any) {
      console.warn(`[GitHub] Releases unavailable for ${item.platform_identifier}: ${err.status || err.message}`);
    }

    insertGithubSnapshot({
      tracked_item_id: item.id,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      open_issues: repoData.open_issues_count,
      watchers: repoData.subscribers_count ?? 0,
      traffic_views: trafficViews,
      traffic_uniques: trafficUniques,
      clones: cloneCount,
      clones_uniques: cloneUniques,
      release_downloads: releaseDownloads,
    });

    console.log(`[GitHub] Collected snapshot for ${item.platform_identifier}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[GitHub] Failed to collect ${item.platform_identifier}: ${err.status || err.message}`);
    return { success: false, error: `${err.status || ''} ${err.message}`.trim() };
  }
}
