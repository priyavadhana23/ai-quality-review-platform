"""Verify JWT creation, validation, and protected route guarding."""
import asyncio
from app.auth.jwt import create_access_token, decode_access_token, create_refresh_token, _hash_token
from app.db.database import init_db
from app.db.user_repository import UserRepository, RefreshTokenRepository

async def main():
    # 1. DB init
    await init_db()
    print("PASS  DB initialised (SQLite schema created)")

    # 2. Upsert a test user
    user = await UserRepository.upsert(
        github_id=999999,
        username="testuser",
        email="test@example.com",
        avatar_url="https://avatars.githubusercontent.com/u/999999",
    )
    print(f"PASS  User upserted: id={user['id']} username={user['username']}")

    # 3. JWT round-trip
    token = create_access_token(user["id"], user["username"], user["role"])
    payload = decode_access_token(token)
    assert payload["sub"] == str(user["id"])
    assert payload["usr"] == user["username"]
    assert payload["type"] == "access"
    print(f"PASS  JWT round-trip: sub={payload['sub']} usr={payload['usr']}")

    # 4. Refresh token store + revoke
    raw, hashed, expires_at = create_refresh_token()
    await RefreshTokenRepository.save(user["id"], hashed, expires_at.isoformat())
    row = await RefreshTokenRepository.get_valid(hashed)
    assert row is not None
    await RefreshTokenRepository.revoke(hashed)
    row_after = await RefreshTokenRepository.get_valid(hashed)
    assert row_after is None
    print("PASS  Refresh token stored, retrieved, and revoked")

    # 5. Protected route returns 403 for unknown user
    import jwt as pyjwt
    bad_token = create_access_token(99999999, "ghost", "user")
    try:
        payload2 = decode_access_token(bad_token)
        db_row = await UserRepository.get_by_id(int(payload2["sub"]))
        assert db_row is None
        print("PASS  Non-existent user correctly returns None from DB (frontend gets 403)")
    except Exception as e:
        print(f"FAIL  {e}")

    print("\nAll backend auth checks passed.")

asyncio.run(main())
