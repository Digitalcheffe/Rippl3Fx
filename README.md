# Rippl3FX

Self-hosted dashboard that tracks how a launch event creates ripples across platforms. One Reddit post, one GitHub release, one blog publish — Rippl3FX measures the spread across Reddit, GitHub, GA4, and Bing.

## Quick Start

```bash
docker compose up --build
```

Open `http://localhost:3000` and create your account on first run.

## Platform Setup

### Reddit

Create a Reddit app to get API credentials.

**If you sign in to Reddit with Google/Apple:** Reddit's API requires a username and password. To add a password to your account, go to https://www.reddit.com/password, enter your Reddit email, and use the reset link to create a password. Your Google SSO login will continue to work alongside the new password.

1. Go to https://www.reddit.com/prefs/apps
2. Click **"create another app..."** at the bottom
3. Fill in:
   - **Name:** Rippl3FX (or anything)
   - **Type:** Select **script**
   - **Redirect URI:** `http://localhost:3000` (not used, but required)
4. Click **Create app**
5. Note down:
   - **Client ID** — the string under the app name (e.g. `a1b2c3d4e5f6g7`)
   - **Client Secret** — labeled "secret"
6. In Rippl3FX Settings → Accounts → Connect Reddit, enter:
   - Your Reddit **username** and **password**
   - The **Client ID** and **Client Secret** from above

### GitHub

Create a Personal Access Token (classic) for API access. Rippl3FX reads repo stats (stars, forks, issues), traffic views/uniques, and clone counts. Traffic and clone data require **push access** to the repo — this only works for your own repos.

> **Why classic?** Fine-grained tokens don't support the Traffic API endpoints (`/repos/{owner}/{repo}/traffic/*`) that Rippl3FX needs. You must use a classic token.

1. Go to https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. You may be prompted for your password or 2FA code
4. Fill in:
   - **Note:** `Rippl3FX`
   - **Expiration:** choose a duration (you'll need to regenerate and update in Rippl3FX when it expires)
5. Select scopes:
   - **`repo`** — required for traffic views, traffic uniques, clone counts, and private repo access
   - That's the only scope needed. Public stats (stars, forks) work with any scope, but traffic/clone data requires `repo`.
6. Scroll down and click **Generate token**
7. **Copy the token immediately** — it starts with `ghp_` and is only shown once. If you lose it, you'll need to generate a new one.
8. In Rippl3FX, go to Settings → Platform Accounts → **+ Add Account**
9. Select **GitHub**, give it a display name, and paste the token into the **Personal Access Token** field
10. Click **Connect**

### GA4 (Google Analytics 4)

GA4 requires a Google Cloud service account. Google Cloud is free for this use case, but requires a credit card on file for verification (you will not be charged).

**Important:** Use a **@gmail.com** account for Google Cloud. Accounts on custom domains (e.g. @yourdomain.com) get auto-assigned to an organization with restrictive policies that block key creation. A plain @gmail.com account avoids this entirely.

#### Part 1: Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Sign in with your **@gmail.com** account
3. Click the project dropdown at the top → **New Project**
4. Name it `Rippl3FX` → **Create**
5. Make sure the new project is selected in the top dropdown

#### Part 2: Enable the Google Analytics Data API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **Google Analytics Data API**
3. Click on it → click **Enable**
4. Wait for it to enable (a few seconds)

#### Part 3: Create a Service Account

1. In the left sidebar, go to **IAM & Admin** → **Service Accounts**
2. Click **+ Create Service Account**
3. Name it `rippl3fx` → click **Create and Continue**
4. **Skip the permissions step** — click **Continue** (permissions are set in GA4, not here)
5. **Skip the users step** — click **Done**

#### Part 4: Download the JSON Key

1. In the Service Accounts list, click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** → click **Create**
5. The JSON file downloads automatically — **keep this file safe, you cannot re-download it**

If you see an error about "Service account key creation is disabled," your account is under an organization policy. Create a new project with a plain @gmail.com account instead (see note above).

#### Part 5: Grant Access in GA4

1. Open https://analytics.google.com
2. Click the **gear icon** (Admin) in the bottom left
3. In the **Property** column, click **Property Access Management**
4. Click the **+** button → **Add users**
5. Paste your service account email address — find it in GCP under IAM & Admin → Service Accounts, it looks like `rippl3fx@your-project.iam.gserviceaccount.com`
6. Set role to **Viewer** (read-only access — this is all Rippl3FX needs)
7. Uncheck "Notify new users by email" (service accounts can't receive email)
8. Click **Add**

#### Part 6: Find Your GA4 Property ID

1. In GA4 Admin, look at the **Property** column
2. Click **Property Details**
3. Copy the **Property ID** — it's a number like `123456789`

#### Part 7: Connect in Rippl3FX

1. In Rippl3FX, go to Settings → Accounts → Connect GA4
2. Enter the **Property ID** from Part 6
3. Open the downloaded JSON key file in a text editor
4. Copy the **entire contents** and paste into the **Service Account JSON** field
5. Click **Connect**

### Bing Webmaster Tools

1. Go to https://www.bing.com/webmasters
2. Sign in and verify your site if you haven't already
3. Click **Settings** (gear icon) → **API Access**
4. Copy your **API Key**
5. In Rippl3FX Settings → Accounts → Connect Bing, enter:
   - **Site URL** — your verified site URL (e.g. `https://yoursite.com`)
   - **API Key** — from the settings above

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
