/**
 * Placeholder weights — to be tuned.
 * Each platform's metric weights must sum to 1.0.
 * Weights determine how much each metric contributes to the interest score.
 */
export const WEIGHTS: Record<string, Record<string, number>> = {
  github: {
    stars:           0.25,
    forks:           0.15,
    open_issues:     0.10,
    traffic_views:   0.20,
    traffic_uniques: 0.10,
    clones:          0.10,
    clones_uniques:  0.10,
  },
  ga4: {
    sessions:        0.30,
    pageviews:       0.25,
    users:           0.25,
    engagement_rate: 0.20,
  },
  bing: {
    impressions: 0.30,
    clicks:      0.30,
    ctr:         0.20,
    avg_rank:    0.20,
  },
};
