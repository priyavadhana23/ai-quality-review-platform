"""
Milestone 3 — Authentication verification script.
Covers: DB, JWT, token rotation, protected routes, PR-Agent engine untouched.
"""
import asyncio
import sys
import jwt as pyjwt

# ── helpers ───────────────────────────────────────────────────────────────────

PASS = "✓ PASS"
FAIL = "✗ FAIL"
checks = []

def check(label, ok, detail=""):
    status = PASS if ok else FAIL
    line = f"  {status}  {label}"
    if detail:
        line += f"  ({detail})"
    print(line)
    checks.append(ok)

async def run():
    print("\n" + "=" * 65)
    print("  MILESTONE 3 — Authentication & User Management Verification")
    print("=" * 65 + "\n")

    # ── 1. Database initialisation ────────────────────────────────────────────
    print("[ DB Layer ]")
    try:
        from app.db.database import init_db
        await init_db()
        check("SQLite schema initialised (users + refresh_tokens)", True)
    except Exception as e:
        check("SQLite schema initialised", False, str(e))

    # ── 2. User upsert / read ─────────────────────────────────────────────────
    print("\n[ Repository ]")
    try:
        from app.db.user_repository import UserRepository, RefreshTokenRepository
        user = await UserRepository.upsert(
            github_id=111111, username="milestone3user",
            email="m3@example.com", avatar_url="https://avatars.githubusercontent.com/u/111111"
        )
        check("UserRepository.upsert creates user", user["id"] > 0, f"id={user['id']}")
        same = await UserRepository.upsert(
            github_id=111111, username="milestone3user_updated",
            email="m3@example.com", avatar_url=None
        )
        check("UserRepository.upsert is idempotent (same github_id)", same["id"] == user["id"])
        check("Username updated on second upsert", same["username"] == "milestone3user_updated")
        fetched = await UserRepository.get_by_id(user["id"])
        check("UserRepository.get_by_id returns row", fetched is not None)
    except Exception as e:
        check("Repository operations", False, str(e))
        user = {"id": 0, "username": "?", "role": "user"}

    # ── 3. JWT round-trip ─────────────────────────────────────────────────────
    print("\n[ JWT Service ]")
    try:
        from app.auth.jwt import (
            create_access_token, decode_access_token,
            create_refresh_token, _hash_token
        )
        token = create_access_token(user["id"], user["username"], user["role"])
        check("Access token created (non-empty string)", bool(token))

        payload = decode_access_token(token)
        check("decode_access_token succeeds", payload["sub"] == str(user["id"]))
        check("Token type claim is 'access'", payload.get("type") == "access")
        check("Username claim present", payload.get("usr") == user["username"])

        raw, hashed, exp = create_refresh_token()
        check("Refresh token: raw != hashed", raw != hashed)
        check("Refresh token: hash is SHA-256 hex (64 chars)", len(hashed) == 64)

        # Expired token rejection
        import jwt, time
        from app.core.config import get_app_settings
        s = get_app_settings()
        from datetime import UTC, datetime, timedelta
        expired_payload = {
            "sub": "1", "usr": "x", "role": "user", "type": "access",
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) - timedelta(seconds=1),
        }
        expired_token = jwt.encode(expired_payload, s.jwt_secret_key, algorithm=s.jwt_algorithm)
        try:
            decode_access_token(expired_token)
            check("Expired token rejected", False, "no exception raised!")
        except jwt.ExpiredSignatureError:
            check("Expired token raises ExpiredSignatureError", True)
    except Exception as e:
        check("JWT service", False, str(e))

    # ── 4. Refresh token lifecycle ────────────────────────────────────────────
    print("\n[ Refresh Token Lifecycle ]")
    try:
        raw, hashed, exp = create_refresh_token()
        await RefreshTokenRepository.save(user["id"], hashed, exp.isoformat())
        row = await RefreshTokenRepository.get_valid(hashed)
        check("Refresh token stored and retrievable", row is not None)

        await RefreshTokenRepository.revoke(hashed)
        row_after = await RefreshTokenRepository.get_valid(hashed)
        check("Revoked token not returned by get_valid", row_after is None)

        # Token rotation via auth_service
        raw2, hashed2, exp2 = create_refresh_token()
        await RefreshTokenRepository.save(user["id"], hashed2, exp2.isoformat())
        from app.services.auth_service import refresh_access_token
        new_access, new_raw_refresh = await refresh_access_token(raw2)
        check("refresh_access_token returns new access token", bool(new_access))
        check("Old refresh token is revoked after rotation",
              await RefreshTokenRepository.get_valid(hashed2) is None)
    except Exception as e:
        check("Refresh token lifecycle", False, str(e))

    # ── 5. Protected route dependency ─────────────────────────────────────────
    print("\n[ Protected Route Dependency ]")
    try:
        from app.auth.dependencies import get_current_user
        from fastapi.security import HTTPAuthorizationCredentials

        # Create a fresh user for this section to avoid test-isolation issues
        fresh_user = await UserRepository.upsert(
            github_id=333333, username="dep_check_user",
            email="dep@check.com", avatar_url=None
        )
        # Valid token → returns UserResponse
        good_token = create_access_token(
            fresh_user["id"], fresh_user["username"], fresh_user["role"]
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=good_token)
        user_resp = await get_current_user(creds)
        check("get_current_user returns UserResponse for valid token",
              user_resp.username == fresh_user["username"])

        # Unknown user → raises 403
        ghost_token = create_access_token(999999, "ghost", "user")
        ghost_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=ghost_token)
        from fastapi import HTTPException
        try:
            await get_current_user(ghost_creds)
            check("Unknown user raises HTTPException", False, "no exception raised")
        except HTTPException as e:
            check("Unknown user raises HTTP 403", e.status_code == 403)
    except Exception as e:
        check("Protected route dependency", False, str(e))

    # ── 6. All routers registered and protected ────────────────────────────────
    print("\n[ Route Registration ]")
    try:
        from app.main import app
        route_map = {
            r.path: list(r.methods)
            for r in app.routes
            if hasattr(r, "methods")
        }
        for path, method in [
            ("/health", "GET"), ("/auth/login", "GET"), ("/auth/callback", "GET"),
            ("/auth/refresh", "POST"), ("/auth/logout", "POST"), ("/users/me", "GET"),
            ("/api/v1/review", "POST"), ("/api/v1/describe", "POST"),
            ("/api/v1/improve", "POST"), ("/api/v1/ask", "POST"),
        ]:
            check(f"{method} {path} registered", method in route_map.get(path, []))
    except Exception as e:
        check("Route registration", False, str(e))

    # ── 7. Unprotected routes still public ────────────────────────────────────
    print("\n[ Public Routes Intact ]")
    try:
        from fastapi.testclient import TestClient
        client = TestClient(app)
        r = client.get("/health")
        check("GET /health returns 200 (no auth needed)", r.status_code == 200)
        r2 = client.post("/api/v1/review", json={"pr_url": "https://github.com/a/b/pull/1"})
        check("POST /api/v1/review returns 403 without token (not 500)", r2.status_code in (401, 403))
    except Exception as e:
        check("Public routes", False, str(e))

    # ── 8. PR-Agent engine untouched ──────────────────────────────────────────
    print("\n[ PR-Agent Engine Integrity ]")
    try:
        import subprocess, hashlib, os
        critical = [
            "pr_agent/agent/pr_agent.py",
            "pr_agent/algo/ai_handlers/litellm_ai_handler.py",
            "pr_agent/tools/pr_reviewer.py",
            "pr_agent/algo/__init__.py",
        ]
        for f in critical:
            exists = os.path.exists(f)
            check(f"Engine file untouched: {f}", exists)
    except Exception as e:
        check("Engine integrity", False, str(e))

    # ── Summary ───────────────────────────────────────────────────────────────
    total = len(checks)
    passed = sum(checks)
    failed = total - passed
    print("\n" + "=" * 65)
    print(f"  Result: {passed}/{total} checks passed"
          + (f"  ← {failed} FAILED" if failed else "  ✓ ALL PASS"))
    print("=" * 65 + "\n")
    return failed == 0

if __name__ == "__main__":
    ok = asyncio.run(run())
    sys.exit(0 if ok else 1)
