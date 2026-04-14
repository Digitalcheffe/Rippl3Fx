# ARCHITECTURE.md — Rippl3FX v0.2.0

## Overview

Rippl3FX is a self-hosted, single-user dashboard that tracks how launch events create ripples across platforms. Connect GitHub, GA4, and Bing — see everything — mark events — measure the spread.

v0.2.0 shifts from item-level tracking to platform-wide visibility with the Ripple Index.

---

## Stack (unchanged)

- **Backend:** Node.js + TypeScript + Express
- **Frontend:** React + Vite + TypeScript
- **Database:** SQLite (better-sqlite3, WAL mode)
- **Scheduler:** node-cron
- **Auth:** bcrypt + JWT (httpOnly cookie) + TOTP (speakeasy)
- **Deployment:** Single Docker image

---

## Data Flow

```
Platforms (GitHub, GA4, Bing)
    │
    ▼ [Polling — node-cron, per-account intervals]
    │
Raw Snapshots ({platform}_snapshots)
    │
    ▼ [Lane Mapping — platforms/*.ts → lanes/mapper.ts]
    │
Lane Values (Reach, Interest, Engagement)
    │
    ├──▶ Hourly Metrics (tracked_hourly_metrics, unified_hourly_metrics) — 48hr TTL
    │
    ├──▶ Daily Rollup ({platform}_daily, unified_metrics) — 1 year retention
    │
    ├──▶ Weekly Rollup ({platform}_weekly) — 1 year retention
    │
    └──▶ Monthly Rollup ({platform}_monthly) — indefinite
    │
    ▼ [Ripple Calculation — lanes/ripple.ts]
    │
Event Baselines + Ripple Index (event_baselines)
    │
    ▼ [API — routes/*.ts]
    │
Frontend (React dashboard, charts, event cards)
```

---

## Database Schema Changes (v0.1.0 → v0.2.0)

### New Tables

```sql
-- Ripple Index baselines per event per lane
CREATE TABLE event_baselines (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id        INTEGER NOT NULL REFERENCES events(id),
  lane            TEXT NOT NULL CHECK(lane IN ('reach','interest','engagement')),
  baseline_value  REAL NOT NULL DEFAULT 0,
  peak_lift       REAL NOT NULL DEFAULT 0,
  peak_date       TEXT,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, lane)
);
```

### Tables Kept As-Is
- `metric_accounts` — platform connections
- `tracked_items` — still used for per-item drill-down
- `tags`, `item_tags` — retained, less prominent in UI
- `events`, `event_tags` — from v0.1.0 issue 68
- All snapshot tables (`github_snapshots`, `ga4_snapshots`, `bing_snapshots`)
- All rollup tables (`{platform}_daily/weekly/monthly`)
- `unified_metrics` — platform-wide aggregates, now the primary data source for Ripple Index
- `hourly_metrics` tables — unchanged, used for Launch Day mode

### Tables Deprecated
- `performance_weights` — no longer used. Leave in DB but stop reading/writing.

---

## Ripple Index Architecture

### When baselines are calculated
- **On event creation**: if 7+ days of pre-event daily data exists in `unified_metrics`, calculate baseline immediately
- **Deferred**: if not enough data, mark as pending. Daily rollup checks for pending baselines.

### When peak lift is updated
- After each daily rollup completes, for each active event (ripple > 0 or < 30 days old):
  1. Read current platform-wide lane totals from `unified_metrics`
  2. Compute lift = current - baseline
  3. If lift > stored peak_lift, update peak_lift and peak_date

### API
```
GET /api/events/:id/ripple
  → { ripple_index, lanes: { reach: score, interest: score, engagement: score },
      trend, days_active, peak_day }

GET /api/events/ripples
  → [{ event_id, name, date, ripple_index, trend, days_active }]
```

---

## Platform Data Expansion (v0.2.0)

### GA4 — Expanded Scope

v0.1.0 pulls: pageviews, users, sessions, engagement_rate per tracked page.

v0.2.0 pulls (property-wide):
- **All pages** — pageviews, users, sessions, engagement_rate, bounce_rate per page path
- **Referral sources** — source/medium breakdown (where traffic comes from)
- **Landing pages** — first-touch pages per session
- **Session metrics** — avg session duration, sessions per user
- **Geographic** — country/city breakdown (optional)

Storage: new `ga4_pages` table for per-page snapshots, `ga4_referrals` for traffic sources.

### GitHub — Already Sufficient

v0.1.0 already pulls comprehensive data:
- Repo stats: stars, forks, watchers, open issues
- Traffic: views, uniques (14-day window)
- Clones: count, uniques
- Releases: download counts

v0.2.0: no schema changes needed. Account-level aggregation already in `unified_metrics`.

### Bing — Limited by API

Bing Webmaster API provides:
- Impressions, clicks, CTR, avg position per URL/keyword
- Limited historical depth

v0.2.0: no schema changes needed. Data is already sufficient for lane mapping.

---

## Frontend Architecture (v0.2.0)

### Pages

```
/                → Dashboard (command center)
/events          → Events page (create/manage, ripple cards)
/github          → GitHub explorer (all repos, account summary)
/ga4             → GA4 explorer (all pages table, property summary)
/bing            → Bing explorer (keywords/pages, site summary)
/settings        → Settings (accounts, profile, week start)
/launch          → Launch Day mode (hourly real-time — Phase 4)
```

### Key Components (new/changed)

```
components/
├── LaneCard.tsx              # Single lane card (replaces LaneSummary 4th card)
├── PlatformToggle.tsx        # Platform on/off chips
├── RippleRing.tsx            # Donut ring showing 0-100 ripple score
├── ActiveRipples.tsx         # Compact row of mini ripple rings for dashboard
├── DateRangeNav.tsx          # Time range + load previous + custom range
├── PlatformBreakdown.tsx     # Per-platform lane sparklines
├── PageTable.tsx             # Sortable table for GA4 pages / Bing keywords
├── RepoCard.tsx              # GitHub repo card with all metrics
├── LayeredInterestChart.tsx  # (kept) Lane chart with event markers
├── Sparkline.tsx             # (kept) Mini inline chart
├── StatCard.tsx              # (kept) Used for drill-down views
└── EmptyState.tsx            # (kept)
```

### Removed Components
- `PerformanceTrend.tsx` — no longer rendered
- `LaneSummary.tsx` performance card — replaced by 3 LaneCards

---

## API Changes

### New Endpoints
```
GET  /api/events/ripples              → all events with ripple index
GET  /api/events/:id/ripple           → single event ripple detail
GET  /api/ga4/pages?range=daily       → all GA4 pages with metrics
GET  /api/ga4/referrals?range=daily   → referral source breakdown
GET  /api/dashboard?compare=true&from=2026-04-01&to=2026-04-07&compareTo=2026-04-08..2026-04-14
                                      → date comparison endpoint
```

### Modified Endpoints
```
GET  /api/dashboard                   → adds platform toggle support (?platforms=github,ga4)
                                      → removes performance score from response
GET  /api/events/:id                  → includes ripple_index in response
```

### Deprecated Endpoints
```
GET  /api/performance                 → returns 410 Gone
POST /api/performance/weights         → returns 410 Gone
```

---

## Migration Path

v0.1.0 → v0.2.0:
1. Migration 034: Create `event_baselines` table
2. Migration 035: Create `ga4_pages` table (if expanding GA4)
3. Migration 036: Create `ga4_referrals` table (if expanding GA4)
4. No destructive migrations — `performance_weights` left in place, just unused
5. Existing data (snapshots, rollups, unified_metrics) remains valid and used
