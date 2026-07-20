"""
Database backend auto-selector.

If APP_DATABASE_URL starts with "postgresql", the asyncpg/SQLAlchemy
PostgreSQL adapter is used.  Otherwise the built-in SQLite adapter
(database.py) is used — keeping full backward compatibility.
"""
from __future__ import annotations

import os

_url = os.environ.get("APP_DATABASE_URL", "")

if _url.startswith("postgresql"):
    from app.db.postgres import execute, fetchall, fetchone, init_db  # noqa: F401
else:
    from app.db.database import execute, fetchall, fetchone, init_db  # noqa: F401

__all__ = ["execute", "fetchall", "fetchone", "init_db"]
