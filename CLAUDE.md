# CLAUDE.md — Rippl3FX

## Project Overview

Rippl3FX is a self-hosted, single-user dashboard that tracks how a launch event creates ripples across platforms. One Reddit post, one GitHub release, one blog publish — Rippl3FX measures the spread across Reddit, GitHub, GA4, and Bing using three universal lanes: **Reach, Interest, Engagement**.

No public API. No multi-tenancy. No webhook ingestion. Connect your accounts, tag what matters, watch the ripple.

---

## Stack

- **Backend:** Node.js + TypeScript + Express
- **Frontend:** React + Vite + TypeScript
- **Database:** SQLite (better-sqlite3)
- **Scheduler:** node-cron
- **Auth:** bcrypt + JWT (httpOnly cookie) + TOTP (speakeasy)
- **Deployment:** Single Docker image — `docker compose up --build`

---

## The Three Lanes

Every platform maps to three universal lanes. Raw numbers only — no weighting at storage time.

| Lane | Definition | Reddit | GitHub | GA4 | Bing |
|------|-----------|--------|--------|-----|------|
| Reach | How far it traveled | view_count | traffic_views, traffic_uniques | pageviews | impressions |
| Interest | How many cared | score, upvote_ratio, upvotes_approx, downvotes_approx | stars, watchers | users | clicks |
| Engagement | How many acted | comment_count | forks, clones, clone_uniques, release_downloads, package_pulls, issues_opened, issues_closed, open_issues_count | sessions, engagement_rate | ctr, avg_rank |

**Notes:**
- Reddit vote counts are fuzzed by Reddit — store as approx, label clearly in UI
- GitHub `watchers` = `subscribers_count` in the API
- Bing `avg_rank` is inverted — lower is better, flip sign for velocity
- GitHub Traffic API retains 14 days only — daily polling is mandatory

---

## Velocity

Day-over-day, week-over-week, month-over-month, and hour-over-hour delta per lane.

**Hourly retention rule — CRITICAL:** Keep hourly snapshots for 48 hours only. Daily rollup runs at 23:55. Hourly purge runs AFTER daily rollup completes. Never lose the first hour of a launch.

**Velocity = raw delta.** No percentage, no normalization. Viral numbers will be large — that's correct.

---

## Performance Score

Exists at three levels only: **Tagged Group, Platform, All Metrics**. Never on individual tracked items.

- Synthesizes three lanes using user-configurable weights
- Default weights: Reach 20%, Interest 30%, Engagement 50%
- Weights stored in `performance_weights` table (single row, must sum to 1.0)
- Math shown beneath every performance chart — always transparent
- User can edit weights in Settings → Performance Weights with live preview

---

## Data Hierarchy

```
All Metrics       → Reach + Interest + Engagement + Performance Score (all platforms)
Platform          → Account stats + Reach + Interest + Engagement + Performance Score
Tagged Group      → Reach + Interest + Engagement + Performance Score (cross-platform)
Individual Item   → Reach + Interest + Engagement + per-metric sparklines (NO performance score)
```

---

## Platform Pages

Each platform page shows:
1. **Account-level stats** — overall presence on that platform (karma, total stars, total sessions, etc.)
2. **Three lanes** — rolled up across all tracked items on this platform
3. **Discovery flow** — browse discoverable content → Get Info (live one-time snapshot) → Tag & Track (enters long-term polling)
4. **Tracked items list** — items already tagged and in long-term polling

---

## Project Structure

```
rippl3fx/
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── db/
│   │   │   ├── connection.ts       # SQLite + WAL mode
│   │   │   ├── migrations/
│   │   │   └── queries/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── accounts.ts
│   │   │   ├── items.ts
│   │   │   ├── tags.ts
│   │   │   ├── metrics.ts
│   │   │   └── performance.ts      # Performance score + weight CRUD
│   │   ├── platforms/              # Platform integrations (NOT collectors/)
│   │   │   ├── reddit.ts
│   │   │   ├── github.ts
│   │   │   ├── ga4.ts
│   │   │   └── bing.ts
│   │   ├── poller/
│   │   │   └── scheduler.ts
│   │   ├── rollup/
│   │   │   ├── daily.ts            # 23:55 — runs BEFORE hourly purge
│   │   │   ├── weekly.ts           # Sunday 23:58
│   │   │   ├── monthly.ts          # Last day 23:59
│   │   │   └── hourly-purge.ts     # Purges hourly rows >48hrs AFTER daily rollup
│   │   ├── lanes/
│   │   │   ├── mapper.ts           # Raw metrics → Reach/Interest/Engagement
│   │   │   ├── velocity.ts         # Delta calculations per time horizon
│   │   │   └── performance.ts      # Performance score using stored weights
│   │   └── auth/
│   │       ├── jwt.ts
│   │       ├── bcrypt.ts
│   │       └── totp.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # All Metrics — lanes + performance + tag filter
│   │   │   ├── Platform.tsx        # Account stats + discovery + tracked items
│   │   │   ├── Settings.tsx        # Profile, password, TOTP, accounts, weights
│   │   │   └── Setup.tsx
│   │   └── components/
│   │       ├── LaneSummary.tsx        # Three big lane cards rolled up per page level
│   │       ├── LaneRow.tsx            # Single lane row: value + sparkline + velocity delta
│   │       ├── PerformanceTrend.tsx   # 7-day trend chart + formula + trend arrow
│   │       ├── Sparkline.tsx
│   │       ├── VelocityBadge.tsx   # Delta + direction per time horizon
│   │       ├── LayeredInterestChart.tsx  # SVG layered area chart per platform
│   │       ├── LayeredInterestChart.tsx
│   │       ├── StatCard.tsx        # Individual item — lanes + sparklines, no performance
│   │       ├── PlatformPill.tsx
│   │       ├── TagChip.tsx
│   │       ├── AccountStats.tsx    # Platform account-level stats block
│   │       ├── DiscoveryPanel.tsx  # Get Info + Tag & Track flow
│   │       └── EmptyState.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── Dockerfile
├── ARCHITECTURE.md
├── ISSUES.md
└── rippl3fx-mockup.jsx
```

---

## Database Schema

### Core Tables

**metric_accounts**
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

**tracked_items**
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

**tags + item_tags**
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

**performance_weights**
```sql
CREATE TABLE performance_weights (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  reach_weight      REAL NOT NULL DEFAULT 0.20,
  interest_weight   REAL NOT NULL DEFAULT 0.30,
  engagement_weight REAL NOT NULL DEFAULT 0.50,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Single row only. Weights must sum to 1.0 — validated on write.
```

### Platform Snapshot Tables

Each platform has 5 tables: `{platform}_snapshots` (hourly, 48hr retention), `{platform}_daily`, `{platform}_weekly`, `{platform}_monthly`.

All rollup tables include `reach_score`, `interest_score`, `engagement_score` columns — raw summed lane values, no weighting.

**Rollup aggregation rules:**
- Cumulative metrics (stars, forks, upvotes_approx, open_issues_count): `MAX` for period
- Incremental metrics (traffic_views, clones, sessions, pageviews, impressions, clicks): `SUM`
- Ratio/derived metrics (upvote_ratio, engagement_rate, ctr, avg_rank): `AVG`

---

## Environment Variables

```env
ENCRYPTION_KEY=   # 32-byte AES-256 key for credential encryption
JWT_SECRET=       # JWT signing secret
PORT=3000
DB_PATH=          # Default: ./data/rippl3fx.db
```

---

## Auth Flow

1. No user in DB → redirect to `/setup`
2. Setup: username, password (bcrypt cost 12), optional TOTP
3. Login: password → if TOTP enabled → TOTP code → JWT httpOnly cookie
4. All `/api/*` routes protected except `/api/auth/*` and `/api/health`
5. Settings: change password, enable/disable/regenerate TOTP

---

## Platform Credential Shapes

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

## Polling Behavior

- node-cron checks every minute for accounts where `next_poll_at <= NOW()` and `is_active = true`
- Only polls accounts with at least one active tracked item
- On success: update `last_polled_at`, set `next_poll_at = NOW() + polling_interval_min`
- On failure: log with context, set `next_poll_at = NOW() + 5 min` (backoff)
- Rollup order: daily rollup → hourly purge (never reverse)

---

## Docker

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

## Development Commands

```bash
cd backend && npm run dev        # ts-node-dev hot reload
cd frontend && npm run dev       # Vite dev server
docker compose up --build        # Full build and run
cd backend && npm run migrate    # Run migrations
```

---

## Claude Code Workflow

### Setup — Create GitHub Issues

```
Read ISSUES.md in full, then create all GitHub issues as defined 
in the Issue Creation Prompt at the bottom of that file.
```

### Per-Issue Build Process

```
Read CLAUDE.md, ARCHITECTURE.md, and ISSUES.md before starting.

I want to build Issue [N]: [Title].

Find the issue in ISSUES.md, read the Description, Acceptance Criteria, 
and Dependencies. Build the code, run verification steps defined in 
the Claude Code Prompt for that issue. When complete, open a PR titled 
exactly as specified. Do not merge — I will review and merge manually.
```

### Rules for Claude Code

- **Always read CLAUDE.md and ARCHITECTURE.md first** — every session
- **One issue per session** — never start the next issue in the same session
- **Run verification before opening PR** — every issue has specific checks
- **Never merge PRs** — open and stop, human merges
- **Never skip dependencies** — prior issues must be merged first
- **Match the mockup** — reference rippl3fx-mockup.jsx for all frontend work
- **platforms/ not collectors/** — always use the correct folder name
- **Rollup before purge** — daily rollup always runs before hourly purge

### Branch Naming

```
issue-{N}-{short-slug}
# Examples:
issue-1-repo-scaffold
issue-6-github-platform
issue-23-dashboard-page
```

---

## Notes for AI Assistants

- Single-user app — never add multi-user flows
- Never log, return, or commit credentials or ENCRYPTION_KEY
- `platforms/` folder not `collectors/` — this is intentional
- Three lanes (Reach/Interest/Engagement) are the core model — never collapse them without user intent
- Performance Score only exists at tagged group, platform, and all-metrics levels — never on individual items
- Weights are user-configurable and stored in `performance_weights` table — never hardcode them
- Always show the weight formula beneath the performance score in the UI
- Rollup must run before hourly purge — never reverse this order
- GitHub Traffic API retains 14 days — daily polling is mandatory, not optional
- Reddit vote counts are approximate — always label as approx in UI
- Bing avg_rank is inverted — flip sign for velocity calculations
- Performance weights use sliders in Settings — must sum to exactly 100%, validated on write
- Display normalization is for charting only — never store normalized values
- `avg_rank` improvement = lower number = positive velocity = flip the sign
