import asyncio
from app.db.database import AsyncSessionLocal
from sqlalchemy import text

async def reset():
    async with AsyncSessionLocal() as db:
        await db.execute(text("DROP SCHEMA public CASCADE"))
        await db.execute(text("CREATE SCHEMA public"))
        await db.commit()

asyncio.run(reset())
