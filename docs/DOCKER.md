# Docker Guide

## Images

### Backend (`Dockerfile.backend`)
- **Base**: `python:3.12-slim`
- **Build stages**: `builder` (installs deps) → `runtime` (lean image)
- **Process manager**: Gunicorn + UvicornWorker
- **Non-root user**: `appuser`
- **Health check**: `curl /health`

```bash
# Build only
docker build -f Dockerfile.backend --target runtime -t qrp-backend .

# Run standalone (SQLite mode)
docker run -p 8000:8000 \
  -e APP_JWT_SECRET_KEY=mysecret \
  -e APP_GITHUB_CLIENT_ID=... \
  qrp-backend
```

### Frontend (`Dockerfile.frontend`)
- **Build stage**: Node 20 Alpine + `npm run build`
- **Runtime stage**: nginx:1.25-alpine serving `/usr/share/nginx/html`
- **SPA routing**: `try_files $uri /index.html`

```bash
docker build -f Dockerfile.frontend \
  --build-arg VITE_API_BASE_URL=https://api.yourdomain.com \
  -t qrp-frontend .
```

## Docker Compose

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f worker

# Scale workers
docker compose up -d --scale worker=3

# Stop everything
docker compose down

# Remove volumes (DESTRUCTIVE — deletes data)
docker compose down -v
```

## Volume Mounts

| Volume | Description |
|--------|-------------|
| `postgres_data` | PostgreSQL data directory |
| `redis_data` | Redis persistence |
| `app_data` | SQLite database + uploaded files |
| `app_logs` | Application logs |
| `nginx_logs` | Nginx access and error logs |

## Networking

Two internal networks:
- `backend_net` — postgres, redis, backend, worker
- `proxy_net` — nginx, backend, frontend

Only nginx exposes ports 80/443 externally.

## Running Migrations in Docker

```bash
docker compose run --rm backend \
  alembic upgrade head
```
