# Rippl3FX

Self-hosted dashboard that tracks how a launch event creates ripples across platforms. One GitHub release, one blog publish, one product launch — Rippl3FX measures the spread across GitHub, GA4, and Bing using three universal lanes: **Reach, Interest, Engagement**.

Mark events (launches, posts, releases) and watch the ripple spread across your connected platforms.

## Quick Start

```bash
git clone https://github.com/Digitalcheffe/Rippl3Fx.git
cd Rippl3Fx
docker compose up --build
```

That's it. Open `http://localhost:3000` and create your account on first run.

The database, encryption keys, and JWT secrets are automatically generated and stored in the Docker volume. Everything persists across restarts.

## Features

- **Three-lane model** — Reach, Interest, Engagement across all platforms
- **Events** — mark launches and releases, see vertical markers on charts
- **Platform polling** — automated data collection with configurable intervals
- **Hourly, daily, weekly, monthly** time ranges with velocity tracking
- **Docker deployment** — single image, SQLite database, zero external dependencies
- **Zero config** — secrets auto-generated on first run, no `.env` required

## Data Persistence

All data lives in `/data` inside the container:

| File | Purpose |
|------|---------|
| `/data/rippl3fx.db` | SQLite database (accounts, metrics, events) |
| `/data/config.json` | Auto-generated encryption key and JWT secret |

The default `docker-compose.yml` mounts a named volume to `/data`. To use a local directory instead:

```yaml
volumes:
  - ./my-data:/data
```

## Platform Setup

See [docs/account-setup.md](docs/account-setup.md) for step-by-step instructions to connect GitHub, GA4, and Bing.

## Configuration

### Week Start Day

By default, weekly metrics use Monday as the first day of the week. Change this in **Settings → Profile → Week Starts On** to any day (Sunday through Saturday). All weekly rollups, chart boundaries, and date labels will align to your preference.

## Environment Variables

All environment variables are **optional**. The app works out of the box with no configuration.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | Auto-generated | Override the encryption key for platform credentials |
| `JWT_SECRET` | Auto-generated | Override the JWT signing secret |
| `PORT` | `3000` | Server port |
| `TZ` | `UTC` | Timezone for rollups (e.g. `America/New_York`) |

If `ENCRYPTION_KEY` or `JWT_SECRET` are not set, the app generates random secrets on first startup and stores them in `/data/config.json`. They persist across restarts via the volume. Setting env vars overrides the stored values.

## Development

```bash
cd backend && npm run dev    # Backend on :3000
cd frontend && npm run dev   # Frontend on :5173
```
