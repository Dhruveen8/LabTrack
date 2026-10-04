import asyncio
import asyncpg
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_db():
    try:
        logger.info(f"Connecting to default 'postgres' database to create {settings.POSTGRES_DB}...")
        
        # Connect to the default 'postgres' database to create the new one
        conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database='postgres',
            host=settings.POSTGRES_SERVER,
            port=settings.POSTGRES_PORT
        )
        
        # Check if database already exists
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", 
            settings.POSTGRES_DB
        )
        
        if not exists:
            # Cannot run CREATE DATABASE in a transaction, must execute directly
            await conn.execute(f'CREATE DATABASE "{settings.POSTGRES_DB}"')
            logger.info(f"Database {settings.POSTGRES_DB} created successfully.")
        else:
            logger.info(f"Database {settings.POSTGRES_DB} already exists.")
            
        await conn.close()
        
    except Exception as e:
        logger.error(f"Failed to create database: {e}")
        
if __name__ == "__main__":
    asyncio.run(create_db())
