import Snoowrap from 'snoowrap';
import { insertRedditSnapshot } from '../db/queries/reddit';
import type { RedditCredentials, TrackedItem } from '../types';

/**
 * Extract Reddit post ID from a full URL.
 * Supports formats like:
 *   https://www.reddit.com/r/selfhosted/comments/abc123/my_post_title/
 *   https://reddit.com/r/selfhosted/comments/abc123/
 *   abc123 (raw ID passthrough)
 */
function extractPostId(platformIdentifier: string): string | null {
  const match = platformIdentifier.match(/\/comments\/([a-z0-9]+)/i);
  if (match) return match[1];
  // If it's already a bare ID (no slashes), use as-is
  if (/^[a-z0-9]+$/i.test(platformIdentifier)) return platformIdentifier;
  return null;
}

export async function collectReddit(item: TrackedItem, credentials: RedditCredentials): Promise<{ success: boolean; error?: string }> {
  const postId = extractPostId(item.platform_identifier);
  if (!postId) {
    return { success: false, error: `Cannot extract post ID from: ${item.platform_identifier}` };
  }

  try {
    const reddit = new Snoowrap({
      userAgent: 'Rippl3FX/1.0',
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
    });

    const submission = await (reddit.getSubmission(postId).fetch() as any);

    // Check for removed/deleted posts
    if (submission.removed || (submission as any).removed_by_category) {
      return { success: false, error: `Post ${postId} has been removed` };
    }

    insertRedditSnapshot({
      tracked_item_id: item.id,
      upvotes: submission.score ?? null,
      upvote_ratio: submission.upvote_ratio ?? null,
      comment_count: submission.num_comments ?? null,
      view_count: (submission as any).view_count ?? 0,
    });

    console.log(`[Reddit] Collected snapshot for ${item.platform_identifier}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Reddit] Failed to collect ${item.platform_identifier}: ${err.message}`);
    return { success: false, error: err.message };
  }
}
