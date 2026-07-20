# Operations Guide

## Monitoring

### Health Checks
```bash
# Backend health
curl https://yourdomain.com/health

# Database connectivity
docker compose exec postgres pg_isready -U qrp -d qrp

# Redis connectivity
docker compose exec redis redis-cli ping

# All container statuses
docker compose ps
```

### Prometheus Metrics
Metrics are exposed at `GET /metrics` when `ENABLE_METRICS=true` is set and
`prometheus-fastapi-instrumentator` is installed.

Key metrics:
- `http_requests_total` — request count by method, handler, status
- `http_request_duration_seconds` — latency histogram
- `http_requests_inprogress` — concurrent requests gauge

### Logs
```bash
# Tail all logs
docker compose logs -f

# Backend only
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

Log files are also written to the `app_logs` Docker volume.

## Scaling

```bash
# Scale Celery workers
docker compose up -d --scale worker=4

# Restart backend only
docker compose restart backend
```

## Backup

### PostgreSQL backup
```bash
docker compose exec postgres \
  pg_dump -U qrp qrp | gzip > backup_$(date +%Y%m%d).sql.gz
```

### PostgreSQL restore
```bash
gunzip -c backup_20250720.sql.gz | \
  docker compose exec -T postgres psql -U qrp qrp
```

## Migrations

```bash
# Apply pending migrations
docker compose run --rm backend alembic upgrade head

# Check current migration version
docker compose run --rm backend alembic current

# Roll back one migration
docker compose run --rm backend alembic downgrade -1
```

## Disaster Recovery

1. **Database failure** — restore from latest pg_dump backup
2. **Redis failure** — Redis is cache-only; services degrade gracefully to no-cache mode
3. **Backend crash** — Gunicorn auto-restarts workers; Docker `unless-stopped` restarts container
4. **Complete outage** — restore from backup, run `alembic upgrade head`, restart compose stack

## Security Checklist

- [ ] `APP_JWT_SECRET_KEY` — set to a 64+ character random string
- [ ] `GITHUB__WEBHOOK_SECRET` — set and matches GitHub App config
- [ ] PostgreSQL — not exposed on public network (internal only)
- [ ] Redis — not exposed on public network (internal only)
- [ ] Nginx — HTTPS only, HTTP redirects to HTTPS
- [ ] SSL certificates — valid and not expired
- [ ] Secrets — stored in environment variables, never committed to git
