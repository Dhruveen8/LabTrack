from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import SystemSetting, User
from app.api.deps import require_admin, get_current_user

router = APIRouter()

class SettingItem(BaseModel):
    key: str
    value: Optional[str] = None

class SettingsResponse(BaseModel):
    settings: Dict[str, str]

@router.get("/", response_model=SettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all system settings as key-value pairs."""
    result = await db.execute(select(SystemSetting))
    settings_list = result.scalars().all()
    settings_dict = {s.key: s.value for s in settings_list}
    return {"settings": settings_dict}

@router.put("/")
async def update_settings(
    settings: Dict[str, str],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Upsert system settings."""
    for key, value in settings.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        existing = result.scalars().first()
        if existing:
            existing.value = value
        else:
            db.add(SystemSetting(key=key, value=value))

    await db.commit()
    return {"message": "Settings updated successfully"}

@router.get("/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalars().first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    return {"key": setting.key, "value": setting.value}
