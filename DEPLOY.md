# Deploying PR-Agent as a Public GitHub App on Railway

This guide turns your local PR-Agent installation into a live service that
**any GitHub user can install on their repository** with one click.

Architecture:

```
GitHub PR event
  → GitHub sends webhook to your Railway URL
    → PR-Agent server receives it
      → Calls Google Gemini API
        → Posts review comment back to GitHub PR
```

Total time: ~30 minutes.  
Cost: free (Railway Hobby free tier + Google AI Studio free tier).

---

## Prerequisites

| What | Why |
|---|---|
| GitHub account | To create the GitHub App |
| Google AI Studio API key | Already configured in `.secrets.toml` |
| Railway account | Free at [railway.app](https://railway.app) |
| Your PR-Agent repo pushed to GitHub | Railway pulls from GitHub |

---

## Step 0 — Confirm your Gemini key works

Before deploying, verify the key in `.secrets.toml` is active:

```bash
cd /Users/priyavadhanam/projects/pr-agent
PYTHONPATH=. .venv/bin/python -m pr_agent.cli \
  --pr_url=https://github.com/priyavadhana23/pr-agent-demo/pull/1 review
```

You should see the review complete with no errors. If you see a 429, see the
**Troubleshooting** section at the bottom.

---

## Step 1 — Create the GitHub App

1. Go to **https://github.com/settings/apps/new**

2. Fill in the form:

   | Field | Value |
   |---|---|
   | **GitHub App name** | `my-pr-agent` (must be globally unique) |
   | **Homepage URL** | `https://github.com/priyavadhana23/pr-agent` |
   | **Webhook URL** | `https://PLACEHOLDER.up.railway.app/api/v1/github_webhooks` ← replace after Step 3 |
   | **Webhook secret** | Run `openssl rand -hex 32` and paste the output. **Save this value** — you need it later. |

3. Under **Repository permissions**, set:

   | Permission | Level |
   |---|---|
   | Contents | Read |
   | Issues | Read & Write |
   | Pull requests | Read & Write |
   | Metadata | Read (auto-selected) |

4. Under **Subscribe to events**, check:
   - ✅ Pull request
   - ✅ Issue comment
   - ✅ Pull request review
   - ✅ Pull request review comment

5. Under **Where can this GitHub App be installed?** → select **Any account**
   (this makes the App installable by other users).

6. Click **Create GitHub App**.

7. On the App settings page that opens:
   - Note the **App ID** (a 6-7 digit number at the top of the page).
   - Scroll to **Private keys** → click **Generate a private key**.
   - A `.pem` file downloads automatically — keep it safe.

---

## Step 2 — Format the private key for Railway

Railway environment variables cannot contain raw newlines. Convert the `.pem`
file to a single-line string:

```bash
# Replace newlines with literal \n
cat ~/Downloads/my-pr-agent.YYYY-MM-DD.private-key.pem \
  | awk 'NF {printf "%s\\n", $0}' \
  | sed 's/\\n$//'
```

Copy the entire output — it starts with `-----BEGIN RSA PRIVATE KEY-----\n`
and ends with `-----END RSA PRIVATE KEY-----`.

---

## Step 3 — Deploy to Railway

### 3a. Push your code to GitHub

```bash
cd /Users/priyavadhanam/projects/pr-agent
git add Dockerfile.railway railway.toml .env.example DEPLOY.md \
        pr_agent/settings/configuration_prod.toml \
        pr_agent/config_loader.py
git commit -m "feat: add Railway production deployment"
git push
```

### 3b. Create a Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo**
3. Select your `pr-agent` repository
4. Railway detects `railway.toml` and uses `Dockerfile.railway` automatically.

### 3c. Set environment variables

In the Railway dashboard, open your service → **Variables** tab → add each
variable below (click **New Variable** for each one):

```
GITHUB__APP_ID                    = <your App ID from Step 1>
GITHUB__PRIVATE_KEY               = <single-line PEM from Step 2>
GITHUB__WEBHOOK_SECRET            = <the secret you generated in Step 1>
GITHUB__DEPLOYMENT_TYPE           = app
GOOGLE_AI_STUDIO__GEMINI_API_KEY  = <your Gemini API key>
CONFIG__MODEL                     = gemini/gemini-3.5-flash
CONFIG__FALLBACK_MODELS           = ["gemini/gemini-3.1-flash-lite"]
GUNICORN_WORKERS                  = 2
CONFIG__LOG_LEVEL                 = INFO
```

> **Important:** The double-underscore (`__`) in variable names is how
> Dynaconf maps them to nested config sections. `GITHUB__APP_ID` becomes
> `settings.github.app_id`. Do not use a single underscore.

### 3d. Get your Railway URL

After the first deploy succeeds (green checkmark), click the service →
**Settings** → **Networking** → **Generate Domain**.

Your URL looks like: `https://my-pr-agent-production.up.railway.app`

Verify it is live:

```bash
curl https://my-pr-agent-production.up.railway.app/
# Expected: {"status":"ok"}
```

---

## Step 4 — Update the webhook URL in GitHub

1. Go back to **https://github.com/settings/apps** → your App → **Edit**
2. Replace the placeholder in **Webhook URL** with:
   ```
   https://my-pr-agent-production.up.railway.app/api/v1/github_webhooks
   ```
3. Click **Save changes**.

---

## Step 5 — Install the App on a repository

1. Go to **https://github.com/settings/apps** → your App → **Install App**
2. Click **Install** next to your account or organisation.
3. Choose **All repositories** or select specific ones.
4. Click **Install**.

---

## Step 6 — Verify end-to-end

Open a pull request in any repository where the App is installed.

Within 30–60 seconds you should see PR-Agent post:
- A PR description update
- A code review comment
- Improvement suggestions

To trigger commands manually, comment on any PR:
```
/review
/describe
/improve
/ask "What does this change do?"
```

---

## Config load order (precedence, lowest → highest)

```
configuration.toml          (shipped defaults)
configuration_prod.toml     (production overrides, baked into image)
settings/.secrets.toml      (dev-only local secrets — empty in image)
settings_prod/.secrets.toml (empty placeholder in image)
Railway environment vars    (HIGHEST — override everything above)
```

Secrets set as Railway variables always win. You can change the model or
log level on a live deployment without rebuilding by editing Railway variables.

---

## Allowing other users to install your App

Your App is already configured as **Any account** in Step 1. Share this
installation URL:

```
https://github.com/apps/<your-app-slug>/installations/new
```

Users click **Install**, select their repo, and PR-Agent starts reviewing
their PRs automatically — using your Gemini key and Railway server.

> **Free-tier quota note:** Google AI Studio's free tier allows ~1,500 requests
> per day per model per project. If many users install the App, you will hit
> this limit. Options:
> - Upgrade to a paid Google AI Studio plan ($0.10/1M tokens for Gemini Flash)
> - Create a separate Google Cloud project for production to get a fresh quota

---

## Troubleshooting

### "status":"ok" returns but webhooks are not processed

Check Railway logs (`railway logs` or the Logs tab in the dashboard) for the
line `Received a GitHub webhook`. If absent, the webhook URL in the GitHub App
settings is wrong — re-check Step 4.

### 403 on webhooks

`GITHUB__WEBHOOK_SECRET` does not match what you entered during App creation.
Re-generate with `openssl rand -hex 32`, update both GitHub App settings and
Railway variable simultaneously.

### 429 from Gemini

Free-tier daily quota is exhausted. Either wait until midnight Pacific for the
quota to reset, or switch to a paid Gemini key. The fallback model
(`gemini/gemini-3.1-flash-lite`) is tried automatically but shares the same
quota pool.

### "Model X is not defined in MAX_TOKENS"

The model name in `CONFIG__MODEL` is not registered in
`pr_agent/algo/__init__.py`. Use one of:
- `gemini/gemini-3.5-flash`
- `gemini/gemini-3.1-flash-lite`
- `gemini/gemini-2.5-flash`
- `gemini/gemini-2.5-pro`

### Railway build fails

Check that `Dockerfile.railway` is at the repository root and `railway.toml`
has `dockerfilePath = "Dockerfile.railway"`. Railway logs the full Docker build
output under the **Build Logs** tab.

### Private key format error

The private key must be a single line with literal `\n` sequences. Re-run the
`awk` command from Step 2 and paste the output fresh into the Railway variable.

---

## Updating a live deployment

```bash
# Make changes locally, then:
git add <changed files>
git commit -m "fix: ..."
git push
```

Railway detects the push, rebuilds the Docker image, and redeploys with zero
downtime (old container stays up until the new one passes the health check).
