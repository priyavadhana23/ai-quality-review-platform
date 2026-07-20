# Deployment Guide — AI Quality Review Platform

## Quick Start (Docker Compose)

```bash
# 1. Copy and fill in environment variables
cp .env.example .env.production
# Edit .env.production with real values

# 2. Build and start all services
docker compose --env-file .env.production up --build -d

# 3. Verify everything is healthy
docker compose ps
curl http://localhost:8000/health
```

## Services Overview

| Service  | Port | Description |
|----------|------|-------------|
| nginx    | 80, 443 | Reverse proxy + SSL termination |
| backend  | 8000 (internal) | FastAPI + Gunicorn |
| frontend | 80 (internal) | React SPA (nginx static) |
| postgres | 5432 (internal) | Primary database |
| redis    | 6379 (internal) | Cache + message broker |
| worker   | — | Celery background worker |

## Database Migration

```bash
# Run Alembic migrations against PostgreSQL
APP_DATABASE_URL=postgresql+asyncpg://qrp:pass@localhost:5432/qrp \
  alembic upgrade head

# Create a new migration after schema changes
alembic revision --autogenerate -m "describe the change"
```

## Cloud Deployment Options

### Railway (recommended for quick start)
1. Push to GitHub
2. Connect repo to Railway
3. Set environment variables from `docs/ENVIRONMENT.md`
4. Railway auto-deploys from `main` branch

### Render
```bash
# render.yaml is included — just connect repo in Render dashboard
```

### Manual (VPS / EC2)
```bash
# Install Docker + Compose
curl -fsSL https://get.docker.com | sh

# Clone and deploy
git clone <repo> && cd pr-agent
cp .env.example .env.production
# Fill in values, then:
docker compose --env-file .env.production up -d
```

## SSL Certificates

Place certificates in `nginx/ssl/`:
```
nginx/ssl/cert.pem
nginx/ssl/key.pem
```

For Let's Encrypt:
```bash
certbot certonly --webroot -w /var/www/certbot -d yourdomain.com
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
docker compose restart nginx
```

## Health Checks

- Backend: `GET /health`
- Frontend: `GET /` (nginx serves index.html)
- Database: `pg_isready -U qrp -d qrp`
- Redis: `redis-cli ping`
