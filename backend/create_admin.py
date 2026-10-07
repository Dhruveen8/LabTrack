"""Create the initial admin from BOOTSTRAP_ADMIN_* settings; no default password."""
import asyncio
from app.db.database import AsyncSessionLocal, engine
from app.startup import bootstrap

async def make_admin():
    try:
        async with AsyncSessionLocal() as db:
            await bootstrap(db)
            await db.commit()
    finally:
        await engine.dispose()

if __name__ == '__main__':
    asyncio.run(make_admin())
