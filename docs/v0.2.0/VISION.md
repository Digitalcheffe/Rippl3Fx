# Rippl3FX v0.2.0 — Vision

## Philosophy Shift

v0.1.0 was built around **tracked items** — you pick specific repos, pages, and URLs, tag them, and watch their metrics. This works but misses the bigger picture. When you post about 4LeafClover on Reddit, people don't just visit that one page — they land on your homepage, browse other pages, check your GitHub profile, star other repos. The ripple spreads everywhere.

v0.2.0 shifts to **platform-wide visibility**. Connect your platforms, see everything, overlay events, and let the data tell the story.

---

## Core Principles

1. **Wide lens, not keyhole.** Show all platform data by default. Don't require users to pre-select what to watch.
2. **Events are investigation anchors.** Both planned ("I'm launching today") and discovered ("what happened on the 8th?"). Tag a date, dig into it.
3. **Three lanes are the abstraction.** Reach, Interest, Engagement are the universal frame. How we get there is per-platform detail — the lanes are the headline.
4. **Filter, don't configure.** Instead of setting up tracked items, users filter and explore what's already there. Toggle platforms on/off, select date ranges, compare periods.
5. **Daily data is permanent.** Keep daily snapshots for up to a year. Let users scroll back through history.

---

## Dashboard — The Command Center

The main dashboard shows overall Reach, Interest, Engagement across all platforms combined. No event context needed — just "how am I doing."

### What's on screen:
- **Three lane cards** — Reach, Interest, Engagement. Current value, change, % change. Always visible.
- **Lane Overview chart** — the existing layered chart with event markers.
- **Platform toggles** — turn platforms on/off to isolate what's driving a change. "Is this spike from GA4 or GitHub?"
- **Date range selector** — daily (show 7 days, load next 7), weekly (show 4 weeks, load next 4), monthly. Plus custom date range picker.
- **Active Ripples row** — compact summary of events with Ripple Index scores (when events exist).

### What's removed:
- Performance Score — replaced by Ripple Index (event-anchored only).
- Tag filter as primary navigation — tags move to events and optional detail views.

---

## Events — Two Modes

### Planned Events
"I'm posting on Reddit today." Create the event before or on the day. The app measures the ripple from that point forward.

### Discovered Events (Tag a Date)
You're looking at the dashboard, see a spike on Tuesday, don't know why. Tag that date: "something happened here." Investigate later. This is forensic — retrospective event creation.

Both use the same data model. The UI distinction is:
- Planned: create from Events page with full details
- Discovered: quick-pin from the chart or date view, fill in details later

---

## Ripple Index (0-100)

Measures how strong the ripple from an event is, using **platform-wide data** (not item-level).

### Calculation:
1. **Baseline** — average of each lane for 7 days before the event, across all platforms
2. **Lift** — current lane values minus baseline
3. **Peak lift** — highest lift observed since the event
4. **Per-lane score** — `clamp((lift / peak_lift) * 100, 0, 100)`
5. **Ripple Index** — weighted blend: `(reach_score * 0.2) + (interest_score * 0.3) + (engagement_score * 0.5)`

### Scale:
- 70-100: Strong ripple (green)
- 30-69: Moderate ripple (yellow)
- 1-29: Fading ripple (red)
- 0: Absorbed / back to baseline (gray)

### Trend labels:
- Spiking — still climbing toward peak
- Plateau — holding near peak
- Fading — declining from peak
- Absorbed — near baseline, ripple over

---

## Platform Pages — Show Everything

Each platform page becomes an explorer, not just a summary.

### GA4:
- **Property-wide summary** — total sessions, users, pageviews, engagement rate
- **All pages table** — every page on the site, sortable by Reach/Interest/Engagement
- **Referral sources** — where traffic is coming from
- **Landing pages** — where people actually arrive
- **Session duration, bounce rate trends**

### GitHub:
- **Account summary** — total stars, forks, profile views across all repos
- **All repos table** — every repo with stars, forks, traffic, clones
- **Sortable by lane** — which repo has the most Reach? Most Engagement?

### Bing:
- **Site-wide summary** — total impressions, clicks, CTR, avg rank
- **All keywords/pages** — search terms and pages with metrics
- **Trend over time** — how search visibility is changing

---

## Date Comparison

Side-by-side comparison of two periods:

| | Apr 1-7 | Apr 8-14 | Delta |
|---|---------|----------|-------|
| Reach | 1,200 | 3,400 | +183% |
| Interest | 45 | 120 | +167% |
| Engagement | 28 | 95 | +239% |

Toggle platforms on/off to find the source. This IS the ripple detector — no formula needed, you can see it.

---

## Hourly Metrics — Launch Day Mode

Separate space for real-time monitoring. When you know something is happening right now:
- Hourly granularity for the last 48 hours
- Live-ish refresh (polling every few minutes)
- Event overlay showing the exact moment

This stays separate from the daily/weekly/monthly analysis views.

---

## Data Retention

| Granularity | Retention |
|-------------|-----------|
| Hourly | 48 hours (existing) |
| Daily | 1 year |
| Weekly | 1 year |
| Monthly | Indefinite |

### Navigation:
- Daily view: show 7 days, "load previous week" button to scroll back
- Weekly view: show 4 weeks, "load previous 4 weeks" to scroll back
- Monthly view: show 6 months, scroll back

---

## What Stays from v0.1.0

- Platform connections and credential storage
- Polling infrastructure and scheduler
- SQLite database and migration system
- Auth (bcrypt + JWT + TOTP)
- Docker deployment
- Events table and CRUD API
- Three-lane model and lane mapping
- Chart components with event markers
- Rollup pipeline (daily/weekly/monthly)

## What Changes

- Tracked items become optional drill-down, not the core flow
- Tags shift from item-level to event-level
- Performance Score removed, replaced by Ripple Index
- Dashboard becomes filter-driven command center
- Platform pages show all data, not just tracked items
- GA4 integration expanded significantly
- Date range selection and period comparison added
- Daily data retention extended to 1 year

## What's New

- Ripple Index (0-100, event-anchored)
- Date comparison (side-by-side periods)
- Platform toggles on dashboard
- "Tag a date" (discovered events from chart)
- Launch Day mode (hourly real-time view)
- Full platform data exploration
