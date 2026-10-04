from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from app.db.database import get_db
from app.db.models import Transfer, TransferStatusEnum, User, RoleEnum, EquipmentModel, Lab, NotificationTypeEnum, NotificationCategoryEnum
from app.api.deps import get_current_user, require_role
from app.api.endpoints.notifications import create_notification

router = APIRouter()

class TransferCreate(BaseModel):
    equipment_model_id: int
    from_lab_id: int
    to_lab_id: int
    quantity: int = 1
    reason: Optional[str] = None

class TransferResponse(BaseModel):
    id: int
    equipment_model_id: int
    from_lab_id: int
    to_lab_id: int
    requester_id: int
    status: TransferStatusEnum
    quantity: int
    reason: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.post("/", response_model=TransferResponse)
async def request_transfer(
    transfer_in: TransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Faculty or Admin can request a transfer."""
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.FACULTY, RoleEnum.ASSISTANT]:
        raise HTTPException(status_code=403, detail="Not authorized to request transfers")
    
    new_transfer = Transfer(
        equipment_model_id=transfer_in.equipment_model_id,
        from_lab_id=transfer_in.from_lab_id,
        to_lab_id=transfer_in.to_lab_id,
        requester_id=current_user.id,
        quantity=transfer_in.quantity,
        reason=transfer_in.reason,
        status=TransferStatusEnum.PENDING
    )
    db.add(new_transfer)
    await db.commit()
    await db.refresh(new_transfer)
    return new_transfer

@router.get("/", response_model=List[TransferResponse])
async def list_transfers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List transfers based on role."""
    if current_user.role == RoleEnum.ADMIN:
        result = await db.execute(select(Transfer))
    elif current_user.role == RoleEnum.ASSISTANT:
        lab_ids = current_user.assigned_labs or []
        if not lab_ids:
            return []
        result = await db.execute(
            select(Transfer).where(
                (Transfer.from_lab_id.in_(lab_ids)) | (Transfer.to_lab_id.in_(lab_ids))
            )
        )
    else:
        result = await db.execute(select(Transfer).where(Transfer.requester_id == current_user.id))
    return result.scalars().all()

@router.patch("/{transfer_id}/status", response_model=TransferResponse)
async def update_transfer_status(
    transfer_id: int,
    status: TransferStatusEnum,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN))
):
    """Admin approves or rejects transfer."""
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalars().first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    transfer.status = status
    transfer.resolved_at = datetime.now(timezone.utc)
    
    # In a real implementation, if status == COMPLETED, we would move units between labs.
    # For now, this is just updating the status request.
    
    await db.commit()
    await db.refresh(transfer)
    
    # Notify requester
    await create_notification(
        db=db,
        user_id=transfer.requester_id,
        title=f"Transfer {status.value.capitalize()}",
        message=f"Your transfer request #{transfer.id} has been marked as {status.value}.",
        type=NotificationTypeEnum.SUCCESS if status == TransferStatusEnum.APPROVED or status == TransferStatusEnum.COMPLETED else NotificationTypeEnum.ERROR,
        category=NotificationCategoryEnum.SYSTEM
    )
    
    return transfer
