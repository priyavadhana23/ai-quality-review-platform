# Architecture — AI Quality Review Platform

## High-Level Architecture

```
Internet
   │
   ▼
┌──────────┐   80/443
│  Nginx   │────────────────────────────────────────┐
│ (proxy)  │                                         │
└──────────┘                                         │
   │ /api/*, /auth/*, /ws/, /webhooks/               │
   ▼                                          React SPA
┌──────────┐   asyncpg   ┌──────────┐        (nginx)
│ FastAPI  │────────────▶│PostgreSQL│
│ Backend  │             └──────────┘
│ (Gunicorn│   redis-py  ┌──────────┐
│ +Uvicorn)│────────────▶│  Redis   │◀──── Celery
└──────────┘             └──────────┘      Worker
      │
      ▼
 PR-Agent Engine
 (Gemini/LiteLLM)
```

## Module Map

```
app/
├── main.py                  FastAPI app factory
├── core/
│   ├── config.py            Pydantic settings (env vars)
│   ├── exceptions.py        Custom exception hierarchy
│   ├── logger.py            Logging setup
│   └── metrics.py           Prometheus instrumentation
├── auth/
│   ├── dependencies.py      get_current_user JWT dependency
│   ├── jwt.py               Token create/decode
│   └── oauth.py             GitHub OAuth flow
├── db/
│   ├── __init__.py          Backend auto-selector (SQLite/PG)
│   ├── database.py          SQLite async adapter
│   ├── postgres.py          PostgreSQL asyncpg adapter
│   ├── user_repository.py   User + token CRUD
│   └── migrations/          Alembic migrations
├── cache/
│   └── redis_client.py      Redis cache layer + @cached decorator
├── workers/
│   └── celery_app.py        Celery tasks for AI operations
├── middleware/
│   ├── cors.py              CORS setup
│   ├── logging.py           Request logging
│   ├── request_id.py        X-Request-ID injection
│   └── security.py          Security headers + rate limiting
├── routers/
│   ├── auth.py              POST /auth/*, GET /users/me
│   ├── review.py            POST /api/v1/review
│   ├── history.py           GET  /api/v1/history
│   ├── analytics.py         GET  /api/v1/analytics/*
│   ├── test_generator.py    POST /api/v1/tests/generate
│   ├── api_quality.py       POST /api/v1/api-quality/analyze
│   ├── security_scanner.py  POST /api/v1/security/analyze
│   ├── reports.py           POST /api/v1/reports/generate
│   ├── workspace.py         /api/v1/workspaces/*
│   ├── ws.py                WebSocket /ws/notifications
│   └── webhooks.py          POST /webhooks/github
└── services/                Business logic (one per module)
```

## Data Flow — AI Review

```
Client POST /api/v1/review
  │
  ▼
review.py router
  │
  ▼
review_service.py
  │  publish_output=False
  ▼
PRAgent.handle_request()   ← PR-Agent engine (unchanged)
  │
  ▼
LiteLLM → Gemini API
  │
  ▼
Artifact captured
  │
  ├── Return JSON to client
  └── (async) save to reviews table
```

## Database Selection

```
APP_DATABASE_URL set?
    YES → app/db/postgres.py  (asyncpg + SQLAlchemy)
    NO  → app/db/database.py  (anyio + sqlite3)
```
Both modules expose identical public interfaces:
`init_db()`, `execute()`, `fetchone()`, `fetchall()`
