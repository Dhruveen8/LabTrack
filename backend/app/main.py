from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api_router import api_router
import asyncio
from contextlib import asynccontextmanager
from app.services.email_notifications import email_worker


@asynccontextmanager
async def lifespan(app):
    stop = asyncio.Event()
    worker = asyncio.create_task(email_worker(stop))
    try:
        yield
    finally:
        stop.set()
        await worker

app = FastAPI(
    lifespan=lifespan,
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configure CORS — reads ALLOWED_ORIGINS from .env (comma-separated)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Also expose health under API prefix for nginx proxy
@app.get(f"{settings.API_V1_STR}/health")
async def api_health_check():
    return {"status": "ok"}

