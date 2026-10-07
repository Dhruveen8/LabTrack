"""Compatibility command for the explicit, non-destructive demo seed."""
import asyncio
import logging
from app.seed_db import seed

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
