# Rippl3FX

Self-hosted dashboard that tracks how a launch event creates ripples across platforms. One GitHub release, one blog publish, one product launch — Rippl3FX measures the spread across GitHub, GA4, and Bing using three universal lanes: **Reach, Interest, Engagement**.

Mark events (launches, posts, releases) and watch the ripple spread across your connected platforms.

## Quick Start

```bash
git clone https://github.com/Digitalcheffe/Rippl3Fx.git
cd Rippl3Fx
cp .env.example .env    # Fill in ENCRYPTION_KEY and JWT_SECRET
docker compose up --build
```

Open `http://localhost:3000` and create your account on first run.

## Features

- **Three-lane model** — Reach, Interest, Engagement across all platforms
- **Events** — mark launches and releases, see vertical markers on charts
- **Platform polling** — automated data collection with configurable intervals
- **Hourly, daily, weekly, monthly** time ranges with velocity tracking
- **Docker deployment** — single image, SQLite database, zero external dependencies

## Platform Setup

See [docs/account-setup.md](docs/account-setup.md) for step-by-step instructions to connect GitHub, GA4, and Bing.

## Configuration

### Week Start Day

By default, weekly metrics use Monday as the first day of the week. Change this in **Settings → Profile → Week Starts On** to any day (Sunday through Saturday). All weekly rollups, chart boundaries, and date labels will align to your preference.

## Environment Variables

```env
ENCRYPTION_KEY=   # Any string — used to encrypt stored credentials (AES-256)
JWT_SECRET=       # Any string — used to sign auth tokens
PORT=3000         # Server port (default 3000)
DB_PATH=          # SQLite path (default ./data/rippl3fx.db)
```

Copy `.env.example` to `.env` and fill in your values before running.

## Development

```bash
cd backend && npm run dev    # Backend on :3000
cd frontend && npm run dev   # Frontend on :5173
```
