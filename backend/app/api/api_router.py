from fastapi import APIRouter

from app.api.endpoints import (
    auth,
    departments,
    labs,
    inventory,
    borrowing,
    notifications,
    settings,
    transfers,
    analytics,
    events,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(labs.router, prefix="/labs", tags=["labs"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(borrowing.router, prefix="/borrowing", tags=["borrowing"])
api_router.include_router(events.router, prefix='/borrowing/events', tags=['events'])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(transfers.router, prefix="/transfers", tags=["transfers"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
