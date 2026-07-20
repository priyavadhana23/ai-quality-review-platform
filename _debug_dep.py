import asyncio, traceback
from app.db.database import init_db
from app.db.user_repository import UserRepository
from app.auth.jwt import create_access_token
from app.auth.dependencies import get_current_user
from fastapi.security import HTTPAuthorizationCredentials

async def main():
    await init_db()
    user = await UserRepository.upsert(
        github_id=222222, username="deptest",
        email="dep@test.com", avatar_url=None
    )
    print(f"user id={user['id']} username={user['username']}")
    token = create_access_token(user["id"], user["username"], user["role"])
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    try:
        result = await get_current_user(creds)
        print(f"SUCCESS: {result.username}")
    except Exception as e:
        traceback.print_exc()
        print(f"FAIL: {e}")

asyncio.run(main())
