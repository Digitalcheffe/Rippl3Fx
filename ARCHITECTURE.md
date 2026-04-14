# Rippl3FX — Architecture & Technical Specification

**Version:** v0.3.0  
**Date:** April 2026  
**Status:** In Design

---

## 1. Overview

Rippl3FX is a self-hosted, single-user dashboard that tracks how a single launch event — a post, a release, a publish — creates ripples across platforms. One blog post creates waves in GitHub traffic, GA4 sessions, and Bing impressions. Rippl3FX measures the spread.

> **Note:** Reddit was removed as a polled platform. Use Events to mark Reddit posts instead — the ripple is measured through the other connected platforms.

The core model is three universal lanes — **Reach, Interest, Engagement** — that every platform maps to. These lanes are shown consistently at every level of the hierarchy: individual tracked item, platform account, tagged group, and the top-level All Metrics view.

---

## 2. Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Node.js + TypeScript + Express | REST API, polling scheduler, rollup jobs |
| Frontend | React + Vite + TypeScript | SPA — consistent with NORA/KaseLog pattern |
| Database | SQLite (better-sqlite3) | Per-platform tables, rollup tables |
| Scheduler | node-cron | Per-account configurable polling intervals |
| Auth | bcrypt + JWT + TOTP (speakeasy) | Single user, optional TOTP second factor |
| Deployment | Single Docker image | `docker compose up --build` |

---

## 3. The Three Lanes

Every platform maps its metrics into three universal lanes. Raw numbers only — no weighting, no normalization at storage time. Display normalization happens at render time for charting only.

### Lane Definitions

**Reach** — how far the content traveled. Passive exposure. Someone saw it.

**Interest** — how many people who saw it cared enough to signal approval. One step beyond passive.

**Engagement** — how many people acted. The highest-intent signal. Requires deliberate effort.

### Platform Metric Mappings

#### Reddit
| Lane | Metrics |
|------|---------|
| Reach | `view_count` |
| Interest | `score` (net upvotes), `upvote_ratio`, `upvotes_approx`, `downvotes_approx` |
| Engagement | `comment_count` |

> Reddit deliberately fuzzes raw vote counts. `upvotes_approx` and `downvotes_approx` are derived from `score` and `upvote_ratio` and stored with an approx flag. `downvotes_approx` acts as a drag signal on engagement.

#### GitHub
| Lane | Metrics |
|------|---------|
| Reach | `traffic_views`, `traffic_uniques` |
| Interest | `stars`, `watchers` (`subscribers_count` in API) |
| Engagement | `forks`, `clones`, `clone_uniques`, `release_downloads`, `package_pulls`, `issues_opened`, `issues_closed`, `open_issues_count` |

> `watchers` is a stronger interest signal than `stars` — opting into notifications requires intent. `release_downloads` and `package_pulls` are the strongest engagement signals — someone is running the software. Issue signals are bidirectional: `issues_opened` is positive engagement, `open_issues_count` trending up without `issues_closed` is a drag signal.

> GitHub Traffic API only retains 14 days. Daily polling is mandatory — missed days cannot be backfilled.

#### GA4
| Lane | Metrics |
|------|---------|
| Reach | `pageviews` |
| Interest | `users` |
| Engagement | `sessions`, `engagement_rate` |

#### Bing
| Lane | Metrics |
|------|---------|
| Reach | `impressions` |
| Interest | `clicks` |
| Engagement | `ctr`, `avg_rank` |

> `avg_rank` is inverted — improvement means the number goes down. Velocity calculation must flip the sign. `ctr` is a derived ratio (clicks / impressions), not a raw count.

---

## 4. Velocity

Velocity is day-over-day, week-over-week, and month-over-month delta for each lane. It answers: is this growing, stable, or declining?

### Time Horizons

| Horizon | Source | Schedule |
|---------|--------|----------|
| Hour over hour | hourly snapshots (48hr retention) | Every hour |
| Day over day | daily rollups | Daily at 23:55 |
| Week over week | weekly rollups | End of week (configurable start day) |
| Month over month | monthly rollups | Last day of month at 23:59 |

### Hourly Retention Rule — CRITICAL

Hourly data is stored in a **separate `hourly_metrics` table** — not in `tracked_metrics` which is reserved for the permanent daily/weekly/monthly pipeline. Hourly data is retained for **48 hours only** then purged. The daily rollup job must capture all hourly rows for that day before any purge runs. The first hour of a launch is often the most significant data point — it must never be lost to a rollup timing gap.

Rollup order on any given night: **daily rollup first, hourly purge second.**

### Velocity Calculation

```
velocity = current_period_value - previous_period_value
```

Raw delta. No percentage, no normalization. If views went from 1,200 to 8,400 the velocity is +7,200. Large numbers on viral content are expected and meaningful — they show the spike clearly.

---

## 5. Performance Score

The Performance Score synthesizes the three lanes into a single indicator. It exists at **three levels only** — never on an individual tracked item.

| Level | Scope |
|-------|-------|
| Tagged Item | All tracked items sharing a tag, across all platforms |
| Platform | All tracked items on that platform |
| All Metrics | Everything — all platforms, all tracked items |

### Computation

Each lane contributes a percentage of 100. Weights are **user-configurable in Settings** with sensible defaults. The math is shown at the bottom of every performance chart so it is always transparent and auditable.

**Default weights (adjustable per user):**
```
Reach      → 20%
Interest   → 30%
Engagement → 50%
```

Engagement carries the most weight because it requires the most effort from the audience. These are defaults only — a user focused on brand awareness might flip to 50/30/20.

### Performance Score Display

- Displayed as a **trend line chart** (`PerformanceTrend` component) — not a static number
- Shows performance trajectory over 7 days as a filled area chart in the accent color
- Trend arrow (↑↓—) comparing today vs yesterday shown top-right of the chart
- Weight formula shown beneath every chart: `Reach 20% · Interest 30% · Engagement 50%`
- Inline link from formula line to Settings → Performance
- User edits weights via **sliders** in Settings — three sliders, one per lane
- Validation: weights must sum to exactly 100% — turns red with warning if not
- Live preview: chart updates as sliders move before saving

---

## 6. Data Hierarchy

The same three lanes appear consistently at every level:

```
All Metrics (top level)
├── Reach:      sum across all platforms + all tracked items
├── Interest:   sum across all platforms + all tracked items
├── Engagement: sum across all platforms + all tracked items
└── Performance Score (weighted, user-configurable)

Platform (e.g. Reddit)
├── Account-level stats (karma, follower count, overall presence)
├── Reach:      sum across all tracked items on this platform
├── Interest:   sum across all tracked items on this platform
├── Engagement: sum across all tracked items on this platform
└── Performance Score
    └── Tracked Items list with Get Info + Tag & Track discovery flow

Tagged Group (e.g. #NORA)
├── Reach:      sum across all items tagged NORA, all platforms
├── Interest:   sum across all items tagged NORA, all platforms
├── Engagement: sum across all items tagged NORA, all platforms
└── Performance Score
    └── Individual item cards (Reach + Interest + Engagement, no Performance Score)

Individual Tracked Item
├── Reach:      raw lane value(s) for this item
├── Interest:   raw lane value(s) for this item
├── Engagement: raw lane value(s) for this item
└── Per-metric sparklines + velocity indicators
    NO Performance Score at this level
```

---

## 7. Platform Pages — Account Stats + Discovery

Each platform page shows two things:

**1. Account-level stats** — your overall presence on that platform, not tied to any specific tracked item.

| Platform | Account Stats |
|----------|--------------|
| Reddit | Total post karma, comment karma, account age, active subreddits |
| GitHub | Total stars across all repos, total forks, total watchers, follower count, total traffic, release download totals |
| GA4 | Total sessions across all properties, total users, total pageviews, top pages |
| Bing | Total impressions, total clicks, average CTR, average rank across all sites |

**2. Discovery flow** — browse your content, get a live snapshot, tag and track.

```
Browse discoverable content (your posts, repos, properties, sites)
    → Get Info button → one-time live snapshot showing three lanes
    → Tag & Track → assign tag → enters long-term polling
```

Nothing is tracked until explicitly tagged. The Get Info step shows a preview before committing to long-term polling.

---

## 8. Data Model

### 8.1 Core Tables

#### metric_accounts

```sql
CREATE TABLE metric_accounts (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  platform             TEXT NOT NULL CHECK(platform IN ('reddit','github','ga4','bing')),
  display_name         TEXT NOT NULL,
  credentials          TEXT NOT NULL,        -- AES-256 encrypted JSON blob
  polling_interval_min INTEGER NOT NULL DEFAULT 60,
  is_active            BOOLEAN NOT NULL DEFAULT 1,
  last_polled_at       DATETIME,
  next_poll_at         DATETIME,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### tracked_items

```sql
CREATE TABLE tracked_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_account_id   INTEGER NOT NULL REFERENCES metric_accounts(id),
  platform_identifier TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### tags + item_tags

```sql
CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE item_tags (
  tracked_item_id INTEGER NOT NULL REFERENCES tracked_items(id),
  tag_id          INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (tracked_item_id, tag_id)
);
```

#### performance_weights

```sql
CREATE TABLE performance_weights (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reach_weight   REAL NOT NULL DEFAULT 0.20,
  interest_weight REAL NOT NULL DEFAULT 0.30,
  engagement_weight REAL NOT NULL DEFAULT 0.50,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Single row only. Always query with LIMIT 1 ORDER BY updated_at DESC.
-- Weights must sum to 1.0 — validated on write.
```

### 8.2 Hourly Metrics (Separate Table)

Hourly lane values are stored in a **dedicated `hourly_metrics` table**, separate from the permanent `tracked_metrics` pipeline. This keeps throwaway real-time data (purged after 48hrs) isolated from the daily/weekly/monthly metrics that feed the permanent rollup chain.

```sql
CREATE TABLE hourly_metrics (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id   INTEGER NOT NULL REFERENCES tracked_items(id),
  platform          TEXT NOT NULL,
  period_start      TEXT NOT NULL,
  reach_value       REAL NOT NULL DEFAULT 0,
  interest_value    REAL NOT NULL DEFAULT 0,
  engagement_value  REAL NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tracked_item_id, period_start)
);
```

### 8.3 Platform Snapshot Tables

Each platform has tables: raw snapshots (per-poll data), daily, weekly, and monthly rollups.

**Rollup strategy per metric type:**

| Type | Aggregation | Examples |
|------|------------|---------|
| Cumulative | Last value in period (MAX) | stars, forks, open_issues_count, upvotes_approx |
| Incremental | Sum of period | traffic_views, clones, sessions, pageviews, impressions, clicks |
| Ratio/Derived | Average of period (AVG) | upvote_ratio, engagement_rate, ctr, avg_rank |

**Rollup chain:** hourly → daily → weekly/monthly (never skip levels, never re-aggregate raw)

**All rollup tables include:** `reach_score`, `interest_score`, `engagement_score` columns — raw summed lane values for that period, no weighting applied.

---

## 9. Application Structure

### 9.1 Backend

```
backend/src/
├── index.ts
├── db/
│   ├── connection.ts
│   ├── migrations/
│   └── queries/
├── routes/
│   ├── auth.ts
│   ├── accounts.ts
│   ├── items.ts
│   ├── tags.ts
│   ├── metrics.ts
│   └── performance.ts        # Performance score + weight CRUD
├── platforms/                # Renamed from collectors/ — platform integrations
│   ├── reddit.ts
│   ├── github.ts
│   ├── ga4.ts
│   └── bing.ts
├── poller/
│   └── scheduler.ts
├── rollup/
│   ├── daily.ts
│   ├── weekly.ts              # User-configurable week start day
│   ├── monthly.ts
│   └── hourly-purge.ts       # Purges hourly_metrics rows >48hrs AFTER daily rollup
├── lanes/
│   ├── mapper.ts             # Maps raw platform metrics → Reach/Interest/Engagement
│   ├── calc.ts               # Config-driven lane calculation with delta tracking
│   ├── velocity.ts           # Delta calculations per time horizon
│   └── performance.ts        # Performance score computation using stored weights
├── utils/
│   ├── timezone.ts           # Timezone-aware date helpers
│   └── week.ts               # Shared getWeekStart/getWeekEnd (configurable start day)
└── auth/
    ├── jwt.ts
    ├── bcrypt.ts
    └── totp.ts
```

### 9.2 Frontend

```
frontend/src/
├── pages/
│   ├── Dashboard.tsx         # All Metrics — lane summary + performance trend + tag filter
│   ├── Platform.tsx          # Account stats + lane summary + performance trend + discovery + items
│   ├── Settings.tsx          # Profile, password, TOTP, accounts, performance weights
│   └── Setup.tsx
└── components/
    ├── LaneSummary.tsx        # Three big lane cards (Reach/Interest/Engagement) rolled up per page
    ├── LaneRow.tsx            # Single lane row inside StatCard: value + sparkline + velocity delta
    ├── PerformanceTrend.tsx   # Full trend line chart with weight formula shown beneath
    ├── Sparkline.tsx
    ├── VelocityBadge.tsx      # Delta + direction arrow per time horizon
    ├── LayeredInterestChart.tsx
    ├── StatCard.tsx           # Individual item card — three LaneRows, no performance score
    ├── PlatformPill.tsx
    ├── TagChip.tsx
    ├── AccountStats.tsx       # Platform account-level stats block
    ├── DiscoveryPanel.tsx     # Browse → Get Info (live snapshot preview) → Tag & Track
    └── EmptyState.tsx
```

---

## 10. UI Aesthetic

> Direction set — final palette locked in. Light cool blue base, vibrant platform colors.

| Element | Value | Notes |
|---------|-------|-------|
| Background | `#eef4fb` light cool blue | Airy, bright, not dark |
| Cards | `#f8fbff` near-white blue tint | Lift off background |
| Nav | `#1e3a5f` deep cool navy | Anchors the page |
| Primary font | DM Mono | All UI text |
| Accent | `#e8622a` warm coral-orange | Tags, buttons, active states, performance chart |
| Reddit | `#e8380d` vivid red-orange | |
| GitHub | `#0969da` GitHub blue | |
| GA4 | `#e6a817` rich amber-gold | |
| Bing | `#00897b` deep teal-green | |
| Lane — Reach | `#0969da` blue | Matches GitHub — reach is about visibility |
| Lane — Interest | `#e6a817` amber-gold | Warm signal — someone cared |
| Lane — Engagement | `#e8380d` red-orange | Hot signal — someone acted |
| Velocity up | `#0d9488` teal | Positive delta |
| Velocity down | `#e8380d` red | Negative delta |
| Velocity flat | `#8baac8` muted blue | No change |

---

## 11. Authentication

Single-user. Credentials configured once on first run. No registration or invite flow.

- Password hashed with bcrypt cost factor 12
- JWT in httpOnly cookie
- Optional TOTP second factor (speakeasy + qrcode)
- Settings: change password, enable/disable/regenerate TOTP

---

## 12. Deployment

```bash
docker compose up --build
```

```yaml
services:
  rippl3fx:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - rippl3fx-data:/app/data
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - JWT_SECRET=${JWT_SECRET}

volumes:
  rippl3fx-data:
```

---

## 13. Platform Credential Shapes

```typescript
// Reddit
{ username: string, password: string, clientId: string, clientSecret: string }

// GitHub
{ personalAccessToken: string }

// GA4
{ propertyId: string, serviceAccountJson: string }

// Bing
{ siteUrl: string, apiKey: string }
```

---

## 14. Navigation Structure

- Top nav: All Metrics | Events | GitHub | GA4 | Bing | Settings
- **All Metrics:** tag filter, three lanes rolled up across all platforms, performance score, layered interest chart
- **Platform pages:** account-level stats, three lanes for that platform, discovery panel (Get Info + Tag & Track), tracked items list
- **Settings:** Profile (username, week start day) / Password / TOTP / Metric Accounts / Performance Weights (adjustable with live preview)
- **First run:** setup screen — username, password, optional TOTP

---

## 15. Key Decisions & Rationale

- **Three lanes not one score** — Reach, Interest, Engagement are fundamentally different signals and should never be collapsed without user intent
- **No weighting at storage time** — raw values stored always; weighting is a display/computation concern only
- **Performance Score only at aggregate levels** — individual items show raw lanes; performance synthesis requires context across multiple items
- **User-configurable weights** — no one weighting scheme is correct for everyone; make it transparent and adjustable
- **Weights shown on chart** — math is always visible so users understand what they're seeing
- **platforms/ not collectors/** — folder name reflects what it is: platform integrations
- **lanes/ module** — clean separation between data collection and lane computation
- **Hourly metrics in separate table** — `hourly_metrics` is throwaway real-time data (purged after 48hrs), kept isolated from the permanent `tracked_metrics` pipeline (daily/weekly/monthly)
- **Hourly purge after daily rollup** — first-hour launch data is irreplaceable; rollup always runs first
- **Configurable week start day** — user can set week boundaries (Settings → Profile) stored in `user.week_start_day`; shared utility `utils/week.ts` replaces all hardcoded Monday logic
- **Delta tracking for cumulative metrics** — GitHub stars/watchers/forks use `metric_previous` table to compute day-over-day deltas from cumulative API values; historical backfill days show 0 (expected, no per-day data from API)
- **Discovery flow before tracking** — Get Info preview before committing to long-term polling keeps data intentional
- **Account stats separate from tracked items** — platform pages show your overall presence independently of what you've chosen to track
