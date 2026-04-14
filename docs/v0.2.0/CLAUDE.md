# CLAUDE.md — Rippl3FX v0.2.0

## What Changed from v0.1.0

v0.1.0 tracked manually-selected items. v0.2.0 shifts to platform-wide visibility with event-anchored ripple analysis.

### Removed
- **Performance Score** — replaced by Ripple Index (event-anchored, 0-100)
- **performance_weights table** — weights move to Ripple Index calculation
- **PerformanceTrend component** — removed from all pages
- **Item-level performance score** — never existed on items, but remove from platform/dashboard totals

### Added
- **Ripple Index** — 0-100 score per event measuring ripple strength across all platforms
- **event_baselines table** — stores pre-event baseline and peak lift per lane per event
- **Platform toggles** — dashboard filter to isolate platform contributions
- **Date range navigation** — "Load Previous" to scroll back through time, custom date ranges
- **Date comparison** — side-by-side period view for before/after analysis
- **Expanded GA4 data** — all pages, referral sources, landing pages, session duration, bounce rate
- **Platform explorer pages** — show all data from each platform, sortable by lane
- **Launch Day mode** — dedicated hourly real-time view

### Changed
- **Dashboard** — 3 lane cards (no performance), Active Ripples row, platform toggles, platform breakdown cards
- **Tags** — shift from item-level to event-level association
- **Tracked items** — become optional drill-down, not the primary navigation
- **Data retention** — daily data kept for 1 year (was 7 days of history)

---

## The Three Lanes (unchanged)

| Lane | Definition | GitHub | GA4 | Bing |
|------|-----------|--------|-----|------|
| Reach | How far it traveled | traffic_views, traffic_uniques | pageviews | impressions |
| Interest | How many cared | stars, watchers | users | clicks |
| Engagement | How many acted | forks, clones, issues, releases | sessions, engagement_rate | ctr, avg_rank |

---

## Ripple Index

### Data Model

```sql
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

### Calculation

1. **Baseline** = avg of platform-wide lane values for 7 days before event_date
2. **Lift** = current platform-wide lane value - baseline
3. **Peak lift** = max lift observed since event_date (stored, updated on each poll)
4. **Lane score** = clamp((lift / peak_lift) * 100, 0, 100)
5. **Ripple Index** = (reach_score * 0.2) + (interest_score * 0.3) + (engagement_score * 0.5)

### Scale
- 70-100: Strong (green)
- 30-69: Moderate (yellow)
- 1-29: Fading (red)
- 0: Absorbed (gray)

### Trend Labels
- **Spiking** — current > previous day, still climbing
- **Plateau** — within 5% of peak
- **Fading** — declining from peak
- **Absorbed** — below 10, near baseline

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Nav: Dashboard | Events | GitHub | GA4 | Bing    [Settings] │
├─────────────────────────────────────────────────────────────┤
│ DASHBOARD                          [Daily] [Weekly] [Monthly]│
│ All Metrics                        [← Load Previous]        │
│─────────────────────────────────────────────────────────────│
│ Platforms: [GitHub ✓] [GA4 ✓] [Bing ✓]                     │
│                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│ │  REACH   │ │ INTEREST │ │ENGAGEMENT│  ← 3 cards, no perf │
│ │  4,760   │ │   189    │ │    67    │                      │
│ │ +1,560   │ │   +47    │ │   +19    │                      │
│ └──────────┘ └──────────┘ └──────────┘                      │
│                                                              │
│ ┌─ ACTIVE RIPPLES ────────────────────────────────────────┐ │
│ │ (95) Blog Post · Day 1 ↑  (72) NORA v2 · Day 4 ↓      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ LANE OVERVIEW ─────────────────────────────────────────┐ │
│ │ [chart with event markers + platform toggle filtering]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ PLATFORM BREAKDOWN ────────────────────────────────────┐ │
│ │ GitHub       │  GA4          │  Bing                    │ │
│ │ R: ▂▃▅▇ 1500│  R: ▂▄▆▇ 2800│  R: ▁▂▃▃ 460            │ │
│ │ I: ▂▃▅▇  95 │  I: ▂▃▅▆  82 │  I: ▁▁▂▂  12            │ │
│ │ E: ▁▂▃▄  32 │  E: ▁▂▃▃  30 │  E: ▁▁▁▁   5            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Platform Pages

### GA4 Page
```
Property-wide: Reach (pageviews) | Interest (users) | Engagement (eng rate)

All Pages table (sortable by any column):
| Page              | Sessions | Users | Pageviews | Eng Rate | Bounce |
|-------------------|----------|-------|-----------|----------|--------|
| /                 | 1,240    | 890   | 3,200     | 68%      | 32%    |
| /blog/why-rippl3fx| 520      | 480   | 840       | 88%      | 12%    |
```

### GitHub Page
```
Account-wide: Reach (views) | Interest (stars) | Engagement (forks+clones)

All Repos (card grid):
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ N.O.R.A      │ │ 4LeafClover  │ │ Rippl3FX     │
│ ★142 ⑂18    │ │ ★38  ⑂5     │ │ ★24  ⑂2     │
│ 👁890 📋45   │ │ 👁320 📋12   │ │ 👁290 📋8    │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Bing Page
```
Site-wide: Reach (impressions) | Interest (clicks) | Engagement (CTR)

Keywords/pages table (sortable):
| Query/Page  | Impressions | Clicks | CTR   | Avg Rank |
```

---

## Data Retention

| Granularity | Retention | Navigation |
|-------------|-----------|------------|
| Hourly | 48 hours | Launch Day mode only |
| Daily | 1 year | Show 7, load previous 7 |
| Weekly | 1 year | Show 4, load previous 4 |
| Monthly | Indefinite | Show 6, load previous 6 |

---

## Events

Two creation modes, same data model:

1. **Planned** — from Events page: name, date, description, URL
2. **Discovered** — from chart: click a date to pin it, fill details later

Events are no longer tag-dependent for their ripple calculation. The Ripple Index uses platform-wide data. Tags on events are for organization/labeling only.

---

## Build Phases

### Phase 1: Dashboard Overhaul
- Remove Performance Score from all pages
- 3 lane cards on dashboard (Reach, Interest, Engagement)
- Platform toggles
- Date range navigation with "Load Previous"

### Phase 2: Ripple Index
- event_baselines table + migration
- Baseline calculation (7-day pre-event avg from unified_metrics)
- Peak lift tracking (updated on each poll)
- Ripple Index API endpoint
- Active Ripples row on dashboard
- Ripple ring on event cards

### Phase 3: Platform Explorer
- Expand GA4 data pull (all pages, referrals, landing pages)
- Platform pages show all data in sortable tables
- Platform-wide lane cards

### Phase 4: Date Comparison + Launch Day
- Side-by-side period comparison view
- Custom date range picker
- Hourly Launch Day mode
- "Tag a date" from chart interaction

---

## File References

- Vision: `docs/v0.2.0/VISION.md`
- Mockup: `docs/v0.2.0/mockup.jsx`
- Architecture: `docs/v0.2.0/ARCHITECTURE.md`
