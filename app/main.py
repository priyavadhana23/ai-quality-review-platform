"""
AI Quality Review Platform — FastAPI application entry point.

Wires routers, middleware, exception handlers, and the DB init lifecycle.
The PR-Agent engine (pr_agent/) is never imported here — all calls are
routed through the service layer.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.config import get_app_settings
from app.core.exceptions import PRAgentAPIError
from app.core.logger import configure_logging, get_logger
from app.core.metrics import setup_metrics
from app.db import init_db
from app.middleware.cors import add_cors_middleware
from app.middleware.logging import LoggingMiddleware
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security import (
    SecurityHeadersMiddleware,
    setup_rate_limiter,
    validate_environment,
)
from app.routers import ask, describe, health, improve, review
from app.routers.analytics import router as analytics_router
from app.routers.api_quality import router as api_quality_router
from app.routers.auth import router as auth_router
from app.routers.history import router as history_router
from app.routers.profile import router as profile_router
from app.routers.reports import router as reports_router
from app.routers.security_scanner import router as security_scanner_router
from app.routers.tasks import router as tasks_router
from app.routers.test_generator import router as test_generator_router
from app.routers.webhooks import router as webhooks_router
from app.routers.workspace import router as workspace_router
from app.routers.ws import router as ws_router

configure_logging()
settings = get_app_settings()


# ── Lifespan: startup and graceful shutdown ───────────────────────────────────

@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and graceful shutdown."""
    logger = get_logger()

    # ── Startup ──────────────────────────────────────────────────────────
    try:
        await init_db()
        logger.info("Database initialised")
    except Exception as exc:
        logger.error(f"Database initialisation warning: {exc}")
    validate_environment()

    yield  # application is serving requests

    # ── Shutdown ─────────────────────────────────────────────────────────
    logger.info("Shutting down — releasing resources")

    # 1. PostgreSQL connection pool
    if os.environ.get("APP_DATABASE_URL", "").startswith("postgresql"):
        try:
            from app.db.postgres import _get_engine
            await _get_engine().dispose()
            logger.info("PostgreSQL connection pool closed")
        except Exception as exc:
            logger.warning(f"PostgreSQL shutdown error: {exc}")

    # 2. Redis async client
    try:
        from app.cache.redis_client import close_redis
        await close_redis()
        logger.info("Redis client closed")
    except Exception as exc:
        logger.warning(f"Redis shutdown error: {exc}")

    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    application = FastAPI(
        title=settings.app_title,
        description=settings.app_description,
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=_lifespan,
    )

    # ── Middleware ─────────────────────────────────────────────────────────
    add_cors_middleware(application)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(RequestIDMiddleware)
    application.add_middleware(LoggingMiddleware)
    setup_rate_limiter(application)
    setup_metrics(application)

    # ── Routers ────────────────────────────────────────────────────────────
    # Public
    application.include_router(health.router)
    application.include_router(auth_router)
    # Protected
    application.include_router(profile_router)
    application.include_router(review.router)
    application.include_router(describe.router)
    application.include_router(improve.router)
    application.include_router(ask.router)
    application.include_router(history_router)
    application.include_router(analytics_router)
    application.include_router(test_generator_router)
    application.include_router(api_quality_router)
    application.include_router(security_scanner_router)
    application.include_router(reports_router)
    application.include_router(workspace_router)
    application.include_router(ws_router)
    application.include_router(webhooks_router)
    application.include_router(tasks_router)

    @application.get("/", include_in_schema=False)
    async def root():
        return RedirectResponse(url="/docs")

    # ── Exception handlers ─────────────────────────────────────────────────
    @application.exception_handler(PRAgentAPIError)
    async def pr_agent_api_error_handler(
        _request: Request, exc: PRAgentAPIError
    ) -> JSONResponse:
        get_logger().warning(f"PRAgentAPIError ({exc.status_code}): {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"status": "error", "message": exc.message},
        )

    @application.exception_handler(ValueError)
    async def value_error_handler(
        _request: Request, exc: ValueError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "message": str(exc)},
        )

    @application.exception_handler(Exception)
    async def generic_error_handler(
        _request: Request, exc: Exception
    ) -> JSONResponse:
        get_logger().exception(f"Unhandled exception: {exc}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Internal server error"},
        )

    return application


app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
