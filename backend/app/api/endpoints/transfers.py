from app.services.lab_access import get_assistant_labs
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from app.db.database import get_db
from app.db.models import (
    Transfer,
    TransferUnit,
    TransferStatusEnum,
    User,
    RoleEnum,
    EquipmentUnit,
    UnitStatusEnum,
    NotificationTypeEnum,
    NotificationCategoryEnum,
)
from app.api.deps import get_current_user
from app.api.endpoints.notifications import create_notification

router = APIRouter()


class TransferCreate(BaseModel):
    from_lab_id: int
    to_lab_id: int
    unit_asset_ids: List[str]
    reason: Optional[str] = None

class TransferResponse(BaseModel):
    id: int
    from_lab_id: int
    to_lab_id: int
    requester_id: int
    requester_name: Optional[str] = None
    status: TransferStatusEnum
    reason: Optional[str] = None
    decision_reason: Optional[str] = None
    decided_by_id: Optional[int] = None
    completed_by_id: Optional[int] = None
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

    if not transfer_in.unit_asset_ids:
        raise HTTPException(status_code=400, detail="Must specify at least one unit to transfer")

    if transfer_in.from_lab_id == transfer_in.to_lab_id:
        raise HTTPException(status_code=400, detail="Source and destination labs must be different")

    # verify units exist and belong to from_lab_id and are AVAILABLE
    units_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id.in_(transfer_in.unit_asset_ids)))
    units = units_result.scalars().all()

    if len(units) != len(transfer_in.unit_asset_ids):
        raise HTTPException(status_code=404, detail="One or more equipment units not found")

    for u in units:
        if u.lab_id != transfer_in.from_lab_id:
            raise HTTPException(status_code=400, detail=f"Unit {u.asset_id} does not belong to lab {transfer_in.from_lab_id}")
        if u.status != UnitStatusEnum.AVAILABLE:
            raise HTTPException(status_code=400, detail=f"Unit {u.asset_id} is not AVAILABLE (current status: {u.status})")

    # Check for active transfers involving these units
    active_transfers = await db.execute(
        select(TransferUnit.unit_asset_id)
        .join(Transfer, Transfer.id == TransferUnit.transfer_id)
        .where(TransferUnit.unit_asset_id.in_(transfer_in.unit_asset_ids))
        .where(Transfer.status.in_([TransferStatusEnum.PENDING, TransferStatusEnum.APPROVED]))
    )
    conflicts = active_transfers.scalars().all()
    if conflicts:
        raise HTTPException(status_code=400, detail=f"Units already in an active transfer: {', '.join(conflicts)}")

    new_transfer = Transfer(
        from_lab_id=transfer_in.from_lab_id,
        to_lab_id=transfer_in.to_lab_id,
        requester_id=current_user.id,
        reason=transfer_in.reason,
        status=TransferStatusEnum.PENDING
    )
    db.add(new_transfer)
    await db.flush()

    for asset_id in transfer_in.unit_asset_ids:
        db.add(TransferUnit(transfer_id=new_transfer.id, unit_asset_id=asset_id))

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
        lab_ids = await get_assistant_labs(db, current_user.id)
        if not lab_ids:
            return []
        result = await db.execute(
            select(Transfer).where(
                (Transfer.from_lab_id.in_(lab_ids)) | (Transfer.to_lab_id.in_(lab_ids))
            )
        )
    else:
        result = await db.execute(select(Transfer).where(Transfer.requester_id == current_user.id))
    transfers = result.scalars().all()
    requester_ids = {transfer.requester_id for transfer in transfers}
    if not requester_ids:
        return []
    users = (await db.execute(select(User.id, User.name).where(User.id.in_(requester_ids)))).all()
    names = {user.id: user.name for user in users}
    return [TransferResponse.model_validate(transfer).model_copy(update={
        "requester_name": names[transfer.requester_id],
    }) for transfer in transfers]

class TransferStatusUpdate(BaseModel):
    status: TransferStatusEnum
    decision_reason: Optional[str] = None

@router.patch("/{transfer_id}/status", response_model=TransferResponse)
async def update_transfer_status(
    transfer_id: int,
    update_data: TransferStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin approves/rejects, or receiving lab assistant completes."""
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalars().first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if update_data.status in (TransferStatusEnum.APPROVED, TransferStatusEnum.REJECTED):
        if current_user.role != RoleEnum.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can approve or reject transfers")

    if update_data.status == TransferStatusEnum.COMPLETED:
        if current_user.role != RoleEnum.ASSISTANT:
            raise HTTPException(status_code=403, detail="Only assistants can complete transfers")
        lab_ids = await get_assistant_labs(db, current_user.id)
        if transfer.to_lab_id not in lab_ids:
            raise HTTPException(status_code=403, detail="Not authorized for destination lab")

    if update_data.status == TransferStatusEnum.CANCELLED:
        if current_user.role != RoleEnum.ADMIN and current_user.id != transfer.requester_id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this transfer")

    tu_result = await db.execute(select(TransferUnit).where(TransferUnit.transfer_id == transfer.id))
    transfer_units = tu_result.scalars().all()
    asset_ids = [tu.unit_asset_id for tu in transfer_units]

    units_res = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id.in_(asset_ids)))
    units = {u.asset_id: u for u in units_res.scalars().all()}

    # State transitions
    if update_data.status == TransferStatusEnum.APPROVED and transfer.status == TransferStatusEnum.PENDING:
        for asset_id in asset_ids:
            if units[asset_id].status != UnitStatusEnum.AVAILABLE:
                raise HTTPException(status_code=400, detail=f"Unit {asset_id} is no longer available")
            units[asset_id].status = UnitStatusEnum.IN_TRANSIT
        transfer.decided_by_id = current_user.id
        transfer.decision_reason = update_data.decision_reason

    elif update_data.status == TransferStatusEnum.REJECTED and transfer.status == TransferStatusEnum.PENDING:
        transfer.decided_by_id = current_user.id
        transfer.decision_reason = update_data.decision_reason

    elif update_data.status == TransferStatusEnum.COMPLETED and transfer.status == TransferStatusEnum.APPROVED:
        for asset_id in asset_ids:
            units[asset_id].status = UnitStatusEnum.AVAILABLE
            units[asset_id].lab_id = transfer.to_lab_id
        transfer.completed_by_id = current_user.id

    elif update_data.status == TransferStatusEnum.CANCELLED:
        # FIX: Only allow cancelling from PENDING state (not after APPROVED/COMPLETED)
        if transfer.status not in (TransferStatusEnum.PENDING,):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel a transfer in '{transfer.status}' state. Only PENDING transfers can be cancelled."
            )
        transfer.decision_reason = update_data.decision_reason

    else:
        raise HTTPException(status_code=400, detail=f"Invalid transition from {transfer.status} to {update_data.status}")

    transfer.status = update_data.status
    if update_data.status in (TransferStatusEnum.COMPLETED, TransferStatusEnum.REJECTED, TransferStatusEnum.CANCELLED):
        transfer.resolved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(transfer)

    # Notify requester
    await create_notification(
        db=db,
        user_id=transfer.requester_id,
        title=f"Transfer {update_data.status.value.capitalize()}",
        message=f"Your transfer request #{transfer.id} has been marked as {update_data.status.value}.",
        type=NotificationTypeEnum.SUCCESS if update_data.status in (TransferStatusEnum.APPROVED, TransferStatusEnum.COMPLETED) else NotificationTypeEnum.ERROR,
        category=NotificationCategoryEnum.SYSTEM
    )

    return transfer
