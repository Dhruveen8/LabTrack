from fastapi import APIRouter

from app.api.endpoints import auth, departments, labs, inventory, borrowing

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(labs.router, prefix="/labs", tags=["labs"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(borrowing.router, prefix="/borrowing", tags=["borrowing"])
# other routers will be added here
