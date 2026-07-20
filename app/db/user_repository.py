"""
User repository — all database operations for the users table.

Follows the Repository Pattern: callers never write raw SQL outside this module.
Swap to PostgreSQL by changing only app/db/database.py; this file stays the same.
"""
from __future__ import annotations

from typing import Any

from app.db.database import execute, fetchone


class UserRepository:
    """Async CRUD operations for the ``users`` table."""

    # ── Read ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def get_by_id(user_id: int) -> dict[str, Any] | None:
        """Fetch a user row by primary key."""
        return await fetchone("SELECT * FROM users WHERE id = ?", (user_id,))

    @staticmethod
    async def get_by_github_id(github_id: int) -> dict[str, Any] | None:
        """Fetch a user row by GitHub user ID."""
        return await fetchone("SELECT * FROM users WHERE github_id = ?", (github_id,))

    # ── Write ─────────────────────────────────────────────────────────────────

    @staticmethod
    async def create(
        github_id: int,
        username: str,
        email: str | None,
        avatar_url: str | None,
        role: str = "user",
    ) -> dict[str, Any]:
        """Insert a new user and return the created row."""
        row_id = await execute(
            """
            INSERT INTO users (github_id, username, email, avatar_url, role)
            VALUES (?, ?, ?, ?, ?)
            """,
            (github_id, username, email, avatar_url, role),
        )
        row = await UserRepository.get_by_id(row_id)
        if row is None:  # pragma: no cover
            raise RuntimeError(f"User insert succeeded but row {row_id} not found")
        return row

    @staticmethod
    async def update_last_login(user_id: int) -> None:
        """Stamp the last_login column to the current UTC time."""
        await execute(
            "UPDATE users SET last_login = datetime('now') WHERE id = ?",
            (user_id,),
        )

    @staticmethod
    async def upsert(
        github_id: int,
        username: str,
        email: str | None,
        avatar_url: str | None,
    ) -> dict[str, Any]:
        """
        Insert the user if they don't exist, otherwise update profile fields
        and stamp last_login.  Returns the current row.
        """
        existing = await UserRepository.get_by_github_id(github_id)
        if existing:
            await execute(
                """
                UPDATE users
                SET username = ?, email = ?, avatar_url = ?, last_login = datetime('now')
                WHERE github_id = ?
                """,
                (username, email, avatar_url, github_id),
            )
            row = await UserRepository.get_by_github_id(github_id)
            return row  # type: ignore[return-value]
        return await UserRepository.create(github_id, username, email, avatar_url)


class RefreshTokenRepository:
    """Async CRUD operations for the ``refresh_tokens`` table."""

    @staticmethod
    async def save(user_id: int, token_hash: str, expires_at: str) -> None:
        """Persist a new refresh token (hashed)."""
        await execute(
            """
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES (?, ?, ?)
            """,
            (user_id, token_hash, expires_at),
        )

    @staticmethod
    async def get_valid(token_hash: str) -> dict[str, Any] | None:
        """Return a non-revoked, non-expired token row, or None."""
        return await fetchone(
            """
            SELECT * FROM refresh_tokens
            WHERE token_hash = ?
              AND revoked   = 0
              AND expires_at > datetime('now')
            """,
            (token_hash,),
        )

    @staticmethod
    async def revoke(token_hash: str) -> None:
        """Mark a refresh token as revoked."""
        await execute(
            "UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?",
            (token_hash,),
        )

    @staticmethod
    async def revoke_all_for_user(user_id: int) -> None:
        """Revoke every refresh token belonging to a user (logout-all)."""
        await execute(
            "UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?",
            (user_id,),
        )
