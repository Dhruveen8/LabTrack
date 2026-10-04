from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.db.models import Notification, NotificationTypeEnum, NotificationCategoryEnum, User
from app.api.deps import get_current_user

router = APIRouter()

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: Optional[str] = None
    type: NotificationTypeEnum
    category: NotificationCategoryEnum
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns notifications for the current user, newest first."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Notification)
        .where(Notification.id == notification_id)
        .where(Notification.user_id == current_user.id)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.read = True
    await db.commit()
    await db.refresh(notif)
    return notif

@router.post("/mark-all-read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .where(Notification.read == False)
        .values(read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}

@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == current_user.id)
        .where(Notification.read == False)
    )
    count = result.scalar() or 0
    return {"unreadCount": count}

async def create_notification(db: AsyncSession, user_id: int, title: str, message: str, type: NotificationTypeEnum, category: NotificationCategoryEnum):
    """Helper function to create notifications server-side."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        category=category,
        read=False
    )
    db.add(notif)
    await db.flush()
    return notif
