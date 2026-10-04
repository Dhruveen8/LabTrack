import asyncio
from sqlalchemy.future import select
from app.db.database import get_db
from app.db.models import User
from app.core.security import get_password_hash

async def reset_passwords():
    async for db in get_db():
        result = await db.execute(select(User))
        users = result.scalars().all()
        new_hash = get_password_hash("password")
        for user in users:
            user.hashed_password = new_hash
            print(f"Updated password for {user.email}")
        
        await db.commit()
        print("All passwords reset to 'password'")
        break

if __name__ == "__main__":
    asyncio.run(reset_passwords())
