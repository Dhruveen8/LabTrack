"""Optional browser QA server on 8001. Disposable fixtures; no mail/schedulers.

Run from backend: .venv/Scripts/python.exe tests/cart_browser_server.py
Stop with Ctrl+C to remove only this server's UUID-scoped fixtures.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.database import AsyncSessionLocal, engine
from app.db.models import User
from app.api.api_router import api_router
from test_cart_integration import fixtures, cleanup

settings.SMTP_ENABLED = False
TEST_PASSWORD = 'CartBrowser-Only-2026!'


@asynccontextmanager
async def lifespan(app):
    async with AsyncSessionLocal() as db:
        data = await fixtures(db)
        for identity in data['users'] + data['assistants']:
            user = await db.get(User, identity.id)
            user.hashed_password = get_password_hash(TEST_PASSWORD)
        await db.commit()
    print(json.dumps({'test_students': [user.email for user in data['users']],
                      'test_assistants': [user.email for user in data['assistants']],
                      'test_password': TEST_PASSWORD,
                      'models': [model.id for model in data['models']],
                      'assets': [unit.asset_id for unit in data['units']]}), flush=True)
    try:
        yield
    finally:
        async with AsyncSessionLocal() as db:
            await cleanup(db, data)
        await engine.dispose()


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:5174'],
                   allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.include_router(api_router, prefix='/api/v1')

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8001, log_level='warning')
