"""
Prometheus metrics instrumentation.

If prometheus-fastapi-instrumentator is installed, metrics are exposed at
GET /metrics and track request counts, latencies, and custom gauges.

Falls back gracefully if the package is not installed (e.g. in tests).
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI

_log = logging.getLogger(__name__)


def setup_metrics(app: "FastAPI") -> None:
    """Attach Prometheus instrumentation to the FastAPI app."""
    try:
        from prometheus_fastapi_instrumentator import Instrumentator

        instrumentator = Instrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            should_respect_env_var=True,
            should_instrument_requests_inprogress=True,
            excluded_handlers=["/metrics", "/health"],
            env_var_name="ENABLE_METRICS",
            inprogress_name="http_requests_inprogress",
            inprogress_labels=True,
        )
        instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
        _log.info("Prometheus metrics enabled at /metrics")
    except ImportError:
        _log.info("prometheus-fastapi-instrumentator not installed — metrics disabled")
    except Exception as exc:
        _log.warning(f"Metrics setup failed: {exc}")
