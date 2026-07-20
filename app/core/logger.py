"""
Application logger.

Wraps the PR-Agent logger (loguru) so the API layer shares the same
log stream without creating a second logging pipeline.

The PR-Agent log module is imported lazily (inside functions) to avoid
triggering the Dynaconf circular-import that occurs when
``pr_agent.config_loader`` and ``pr_agent.log`` are initialised at the
same module-load time.  All call sites that need a logger should call
``get_logger()`` at the start of the function, not at import time.
"""
from __future__ import annotations


def configure_logging() -> None:
    """Initialise the shared logger with the configured log level.

    Called once at application startup.  Uses the PR-Agent ``setup_logger``
    function so both the engine and the API write to the same sink.
    """
    from pr_agent.log import setup_logger  # lazy to avoid circular import

    from app.core.config import get_app_settings

    settings = get_app_settings()
    setup_logger(level=settings.log_level)


def get_logger():
    """Return the shared loguru logger instance.

    All application modules should call this at function scope, not at
    module scope, so the import happens after the PR-Agent package is
    fully initialised.
    """
    from pr_agent.log import get_logger as _get  # lazy to avoid circular import

    return _get()
