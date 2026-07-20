# Environment Variable Reference

All backend variables use the prefix `APP_` when read by the FastAPI server.

## Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_JWT_SECRET_KEY` | HMAC secret for JWT signing. Generate with `openssl rand -hex 32`. | `a3f8...` |
| `APP_GITHUB_CLIENT_ID` | GitHub OAuth App client ID | `Iv1.abc123` |
| `APP_GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | `abc123...` |
| `APP_GITHUB_CALLBACK_URL` | Full callback URL registered in GitHub OAuth App | `https://yourdomain.com/auth/callback` |
| `APP_FRONTEND_URL` | Base URL of the React frontend | `https://yourdomain.com` |
| `GOOGLE_AI_STUDIO__GEMINI_API_KEY` | Gemini API key from Google AI Studio | `AIza...` |

## Database

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_DATABASE_URL` | PostgreSQL connection string (asyncpg). If unset, SQLite is used. | *(SQLite)* |
| `POSTGRES_PASSWORD` | PostgreSQL password (docker-compose only) | `qrppass` |

## Redis / Cache

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_REDIS_URL` | Redis connection string | *(disabled)* |

## PR-Agent / AI

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB__APP_ID` | GitHub App ID (for PR-Agent engine) | — |
| `GITHUB__PRIVATE_KEY` | GitHub App private key PEM | — |
| `GITHUB__WEBHOOK_SECRET` | Webhook HMAC secret | — |
| `CONFIG__MODEL` | Default LLM model | `gemini/gemini-1.5-flash` |
| `CONFIG__FALLBACK_MODELS` | JSON array of fallback models | `["gemini/gemini-1.5-flash-lite"]` |

## Server Tuning

| Variable | Description | Default |
|----------|-------------|---------|
| `GUNICORN_WORKERS` | Number of Gunicorn worker processes | `2` |
| `APP_LOG_LEVEL` | Log level: DEBUG/INFO/WARNING/ERROR | `INFO` |
| `APP_PORT` | Port the backend listens on | `8000` |
| `APP_ENV` | Environment: development/production | `development` |
| `APP_CORS_ORIGINS` | Comma-separated allowed CORS origins | `*` |

## Frontend (Vite build-time)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API base URL (injected at build) |

## Webhooks

| Variable | Description |
|----------|-------------|
| `APP_WEBHOOK_USER_ID` | User ID for auto-triggered webhook reviews |
