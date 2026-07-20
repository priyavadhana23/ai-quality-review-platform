"""
CORS middleware configuration.

Reads allowed origins from ``APP_CORS_ORIGINS`` (comma-separated).
Default is ``"*"`` for development convenience; tighten for production.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_app_settings


def add_cors_middleware(application: FastAPI) -> None:
    """Register the CORS middleware on *application*.

    Args:
        application: The FastAPI application instance.
    """
    settings = get_app_settings()
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
