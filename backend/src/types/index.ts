export interface MetricAccount {
  id: number;
  platform: 'reddit' | 'github' | 'ga4' | 'bing';
  display_name: string;
  credentials: string; // AES-256 encrypted JSON blob
  polling_interval_min: number;
  is_active: number;
  last_polled_at: string | null;
  next_poll_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackedItem {
  id: number;
  metric_account_id: number;
  platform_identifier: string;
  display_name: string;
  is_active: number;
  created_at: string;
}

export interface GithubCredentials {
  personalAccessToken: string;
}

export interface RedditCredentials {
  username: string;
  password: string;
  clientId: string;
  clientSecret: string;
}

export interface GA4Credentials {
  propertyId: string;
  serviceAccountJson: string;
}

export interface BingCredentials {
  siteUrl: string;
  apiKey: string;
}

export interface GithubSnapshot {
  id: number;
  tracked_item_id: number;
  stars: number | null;
  forks: number | null;
  open_issues: number | null;
  traffic_views: number | null;
  traffic_uniques: number | null;
  clones: number | null;
  clones_uniques: number | null;
  collected_at: string;
}
