from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
from datetime import datetime, timezone

from app.db.database import get_db
from app.db.models import Request, Transaction, EquipmentModel, EquipmentUnit, Lab, RoleEnum, User, RequestStatusEnum, TransactionStatusEnum, UnitStatusEnum
from app.schemas.borrowing import RequestCreate, RequestResponse, CheckoutRequest, ReturnRequest, TransactionResponse
from app.api.deps import get_current_user, require_role

router = APIRouter()

@router.post("/requests", response_model=RequestResponse)
async def create_request(
    req_in: RequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [RoleEnum.STUDENT, RoleEnum.FACULTY]:
        raise HTTPException(status_code=403, detail="Only students and faculty can make reservations")

    # Validate borrowing limit
    delta = req_in.required_until - req_in.required_from
    if current_user.role == RoleEnum.STUDENT and delta.days > 14:
        raise HTTPException(status_code=400, detail="Students can borrow for a maximum of 14 days")
    if current_user.role == RoleEnum.FACULTY and delta.days > 30:
        raise HTTPException(status_code=400, detail="Faculty can borrow for a maximum of 30 days")

    # Check equipment exists
    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == req_in.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")

    # Check if there are any available units
    unit_result = await db.execute(
        select(func.count(EquipmentUnit.asset_id))
        .where(EquipmentUnit.model_id == req_in.model_id)
        .where(EquipmentUnit.status == UnitStatusEnum.AVAILABLE)
    )
    available_count = unit_result.scalar()
    if available_count == 0:
        raise HTTPException(status_code=400, detail="No units available for this equipment model")

    new_request = Request(
        requester_id=current_user.id,
        model_id=req_in.model_id,
        lab_id=eq_model.lab_id,
        required_from=req_in.required_from,
        required_until=req_in.required_until,
        status=RequestStatusEnum.PENDING
    )
    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)
    return new_request

@router.get("/requests/pending", response_model=List[RequestResponse])
async def get_pending_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    # Assistant only sees requests for labs they are assigned to
    lab_ids = current_user.assigned_labs or []
    if not lab_ids:
        return []
        
    result = await db.execute(
        select(Request)
        .where(Request.lab_id.in_(lab_ids))
        .where(Request.status == RequestStatusEnum.PENDING)
    )
    return result.scalars().all()

@router.post("/requests/{request_id}/approve", response_model=RequestResponse)
async def approve_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    req_result = await db.execute(select(Request).where(Request.id == request_id))
    req = req_result.scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    # Check if assistant manages this lab
    lab_ids = current_user.assigned_labs or []
    if req.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized to approve for this lab")

    req.status = RequestStatusEnum.APPROVED
    await db.commit()
    await db.refresh(req)
    return req

@router.post("/checkout", response_model=TransactionResponse)
async def checkout_equipment(
    checkout_req: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    req_result = await db.execute(select(Request).where(Request.id == checkout_req.request_id))
    req = req_result.scalars().first()
    if not req or req.status != RequestStatusEnum.APPROVED:
        raise HTTPException(status_code=400, detail="Invalid request or request not approved")
        
    unit_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == checkout_req.asset_id))
    unit = unit_result.scalars().first()
    
    if not unit:
        raise HTTPException(status_code=404, detail="Equipment unit not found")
    if unit.model_id != req.model_id:
        raise HTTPException(status_code=400, detail="QR code asset does not match the requested equipment model")
    if unit.status != UnitStatusEnum.AVAILABLE:
        raise HTTPException(status_code=400, detail="Equipment unit is not available")

    # Update statuses
    unit.status = UnitStatusEnum.ISSUED
    req.status = RequestStatusEnum.ISSUED
    
    transaction = Transaction(
        request_id=req.id,
        unit_asset_id=unit.asset_id,
        borrower_id=req.requester_id,
        lab_id=req.lab_id,
        due_date=req.required_until,
        status=TransactionStatusEnum.ACTIVE
    )
    
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction

@router.post("/return", response_model=TransactionResponse)
async def return_equipment(
    ret_req: ReturnRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    # Find active transaction for this unit
    trans_result = await db.execute(
        select(Transaction)
        .where(Transaction.unit_asset_id == ret_req.asset_id)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )
    transaction = trans_result.scalars().first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="No active transaction found for this asset")
        
    unit_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == ret_req.asset_id))
    unit = unit_result.scalars().first()
    
    req_result = await db.execute(select(Request).where(Request.id == transaction.request_id))
    req = req_result.scalars().first()

    # Update statuses
    transaction.status = TransactionStatusEnum.RETURNED
    transaction.return_date = datetime.now(timezone.utc)
    unit.status = UnitStatusEnum.AVAILABLE
    unit.condition = ret_req.condition_remarks or unit.condition
    req.status = RequestStatusEnum.RETURNED
    
    await db.commit()
    await db.refresh(transaction)
    return transaction
