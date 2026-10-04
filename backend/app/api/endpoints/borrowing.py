from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
from datetime import datetime, timezone

from app.db.database import get_db
from app.db.models import Request, Transaction, EquipmentModel, EquipmentUnit, Lab, RoleEnum, User, RequestStatusEnum, TransactionStatusEnum, UnitStatusEnum, EquipmentTypeEnum, NotificationTypeEnum, NotificationCategoryEnum
from app.schemas.borrowing import RequestCreate, RequestResponse, CheckoutRequest, ReturnRequest, TransactionResponse, ExtensionRequest, QuickBorrowRequest, WalkInIssueRequest
from app.api.deps import get_current_user, require_role
from app.api.endpoints.notifications import create_notification
from datetime import timedelta

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

    # Enforce max 3 concurrent items limit for students
    if current_user.role == RoleEnum.STUDENT:
        active_requests_query = await db.execute(
            select(func.count(Request.id))
            .where(Request.requester_id == current_user.id)
            .where(Request.status.in_([RequestStatusEnum.PENDING, RequestStatusEnum.APPROVED, RequestStatusEnum.ISSUED, RequestStatusEnum.EXTENSION_PENDING]))
        )
        active_count = active_requests_query.scalar() or 0
        if active_count >= 3:
            raise HTTPException(status_code=400, detail="Students cannot have more than 3 active requests or borrowed items simultaneously.")

    # Check equipment exists
    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == req_in.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")

    # Removed the check for available units to support waitlisting
    # as the frontend explicitly allows users to request when 0 units are available.

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

@router.get("/requests", response_model=List[RequestResponse])
async def list_all_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == RoleEnum.ADMIN:
        result = await db.execute(select(Request))
    elif current_user.role == RoleEnum.ASSISTANT:
        lab_ids = current_user.assigned_labs or []
        if not lab_ids:
            return []
        result = await db.execute(select(Request).where(Request.lab_id.in_(lab_ids)))
    else:
        # Students/Faculty see only their own requests
        result = await db.execute(select(Request).where(Request.requester_id == current_user.id))
    return result.scalars().all()

@router.get("/transactions", response_model=List[TransactionResponse])
async def list_all_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == RoleEnum.ADMIN:
        result = await db.execute(select(Transaction))
    elif current_user.role == RoleEnum.ASSISTANT:
        lab_ids = current_user.assigned_labs or []
        if not lab_ids:
            return []
        result = await db.execute(select(Transaction).where(Transaction.lab_id.in_(lab_ids)))
    else:
        result = await db.execute(select(Transaction).where(Transaction.borrower_id == current_user.id))
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
    
    await create_notification(
        db=db,
        user_id=req.requester_id,
        title="Request Approved",
        message=f"Your request #{req.id} has been approved. You can pick it up at the lab.",
        type=NotificationTypeEnum.SUCCESS,
        category=NotificationCategoryEnum.REQUEST
    )
    
    return req

# --- BE-1: Reject endpoint ---
@router.post("/requests/{request_id}/reject", response_model=RequestResponse)
async def reject_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    req_result = await db.execute(select(Request).where(Request.id == request_id))
    req = req_result.scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    lab_ids = current_user.assigned_labs or []
    if req.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")
    
    req.status = RequestStatusEnum.REJECTED
    await db.commit()
    await db.refresh(req)

    await create_notification(
        db=db,
        user_id=req.requester_id,
        title="Request Rejected",
        message=f"Your request #{req.id} was rejected by the lab assistant.",
        type=NotificationTypeEnum.ERROR,
        category=NotificationCategoryEnum.REQUEST
    )

    return req

# --- BE-2: Extension request endpoints ---
@router.post("/requests/{request_id}/extend", response_model=RequestResponse)
async def request_extension(
    request_id: int,
    ext_in: ExtensionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Student/Faculty submits extension request."""
    if current_user.role not in [RoleEnum.STUDENT, RoleEnum.FACULTY]:
        raise HTTPException(status_code=403, detail="Only students and faculty can request extensions")
    
    req_result = await db.execute(select(Request).where(Request.id == request_id))
    req = req_result.scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")
    
    if req.status != RequestStatusEnum.ISSUED:
        raise HTTPException(status_code=400, detail="Can only extend issued requests")
    
    # Validate extension duration limit
    total_delta = ext_in.new_due_date - req.required_from
    if current_user.role == RoleEnum.STUDENT and total_delta.days > 14:
        raise HTTPException(status_code=400, detail="Total borrowing period including extension cannot exceed 14 days for students.")
    if current_user.role == RoleEnum.FACULTY and total_delta.days > 30:
        raise HTTPException(status_code=400, detail="Total borrowing period including extension cannot exceed 30 days for faculty.")
    
    req.status = RequestStatusEnum.EXTENSION_PENDING
    req.required_until = ext_in.new_due_date
    await db.commit()
    await db.refresh(req)
    return req

@router.post("/requests/{request_id}/approve-extension", response_model=RequestResponse)
async def approve_extension(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    """Assistant approves extension, updates transaction due_date."""
    req_result = await db.execute(select(Request).where(Request.id == request_id))
    req = req_result.scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    lab_ids = current_user.assigned_labs or []
    if req.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")
    
    if req.status != RequestStatusEnum.EXTENSION_PENDING:
        raise HTTPException(status_code=400, detail="No pending extension for this request")
    
    # Update the transaction due_date
    trans_result = await db.execute(
        select(Transaction)
        .where(Transaction.request_id == request_id)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )
    transaction = trans_result.scalars().first()
    if transaction:
        transaction.due_date = req.required_until
        transaction.reissued_count += 1
    
    req.status = RequestStatusEnum.EXTENDED
    await db.commit()
    await db.refresh(req)

    await create_notification(
        db=db,
        user_id=req.requester_id,
        title="Extension Approved",
        message=f"Your extension for request #{req.id} is approved. New due date is {req.required_until.strftime('%Y-%m-%d')}.",
        type=NotificationTypeEnum.SUCCESS,
        category=NotificationCategoryEnum.EXTENSION
    )

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

    await create_notification(
        db=db,
        user_id=req.requester_id,
        title="Equipment Checked Out",
        message=f"Asset {unit.asset_id} has been issued to you. Due on {req.required_until.strftime('%Y-%m-%d')}.",
        type=NotificationTypeEnum.INFO,
        category=NotificationCategoryEnum.CHECKOUT
    )

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
    transaction.return_date = datetime.utcnow()
    unit.status = UnitStatusEnum.AVAILABLE
    unit.condition = ret_req.condition_remarks or unit.condition
    req.status = RequestStatusEnum.RETURNED
    
    await db.commit()
    await db.refresh(transaction)

    await create_notification(
        db=db,
        user_id=transaction.borrower_id,
        title="Equipment Returned",
        message=f"Your return for asset {ret_req.asset_id} was successfully processed.",
        type=NotificationTypeEnum.SUCCESS,
        category=NotificationCategoryEnum.RETURN
    )

    return transaction

# --- Phase 5: Quick-Borrow endpoint ---
@router.post("/quick-borrow", response_model=TransactionResponse)
async def quick_borrow(
    quick_req: QuickBorrowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    """Quick-borrow flow: assistant scans student ID + equipment QR, auto-issues."""
    # Verify unit exists
    unit_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == quick_req.asset_id))
    unit = unit_result.scalars().first()
    if not unit:
        raise HTTPException(status_code=404, detail="Equipment unit not found")
    if unit.status != UnitStatusEnum.AVAILABLE:
        raise HTTPException(status_code=400, detail="Equipment unit is not available")

    # Verify it's a quick-borrow type item
    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == unit.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model or eq_model.equipment_type != EquipmentTypeEnum.QUICK_BORROW:
        raise HTTPException(status_code=400, detail="This equipment is not configured for quick-borrow")

    # Verify borrower exists
    borrower_result = await db.execute(select(User).where(User.id == quick_req.borrower_id))
    borrower = borrower_result.scalars().first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    if borrower.role != RoleEnum.FACULTY:
        raise HTTPException(status_code=403, detail="Only faculty members can borrow equipment daily via Quick Borrow")

    # Auto-create Request with status=ISSUED (skip PENDING/APPROVED)
    now = datetime.now(timezone.utc)
    end_of_today = now.replace(hour=23, minute=59, second=59)

    new_request = Request(
        requester_id=quick_req.borrower_id,
        model_id=eq_model.id,
        lab_id=eq_model.lab_id,
        required_from=now,
        required_until=end_of_today,
        status=RequestStatusEnum.ISSUED
    )
    db.add(new_request)
    await db.flush()  # Get ID before creating transaction

    # Mark unit as ISSUED
    unit.status = UnitStatusEnum.ISSUED

    # Auto-create Transaction with due_date = end_of_today
    transaction = Transaction(
        request_id=new_request.id,
        unit_asset_id=unit.asset_id,
        borrower_id=quick_req.borrower_id,
        lab_id=eq_model.lab_id,
        due_date=end_of_today,
        status=TransactionStatusEnum.ACTIVE,
        is_quick_borrow=True
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction

# --- Phase 5: Quick-Return endpoint ---
@router.post("/quick-return", response_model=TransactionResponse)
async def quick_return(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    """Quick-return: scan asset QR, auto-locate active transaction, mark returned."""
    trans_result = await db.execute(
        select(Transaction)
        .where(Transaction.unit_asset_id == asset_id)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )
    transaction = trans_result.scalars().first()
    if not transaction:
        raise HTTPException(status_code=404, detail="No active transaction found for this asset")

    unit_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == asset_id))
    unit = unit_result.scalars().first()

    req_result = await db.execute(select(Request).where(Request.id == transaction.request_id))
    req = req_result.scalars().first()

    transaction.status = TransactionStatusEnum.RETURNED
    transaction.return_date = datetime.now(timezone.utc)
    unit.status = UnitStatusEnum.AVAILABLE
    if req:
        req.status = RequestStatusEnum.RETURNED

    await db.commit()
    await db.refresh(transaction)
    return transaction

# --- Phase 5: Quick-borrow stats ---
@router.get("/quick-borrow/stats")
async def quick_borrow_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    """Returns quick-borrow stats for the assistant dashboard."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Items currently out (quick-borrow, active)
    out_result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.is_quick_borrow == True)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )
    currently_out = out_result.scalar() or 0

    # Items returned today
    returned_result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.is_quick_borrow == True)
        .where(Transaction.status == TransactionStatusEnum.RETURNED)
        .where(Transaction.return_date >= today_start)
    )
    returned_today = returned_result.scalar() or 0

    # Overdue quick items (due_date < now and still active)
    overdue_result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.is_quick_borrow == True)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
        .where(Transaction.due_date < datetime.now(timezone.utc))
    )
    overdue = overdue_result.scalar() or 0

    return {
        "currentlyOut": currently_out,
        "returnedToday": returned_today,
        "overdue": overdue
    }

# --- Walk-In Issue Endpoint ---
@router.post("/walk-in", response_model=TransactionResponse)
async def walk_in_issue(
    walkin_req: WalkInIssueRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    try:
        # 1. Verify unit exists and is AVAILABLE
        unit_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == walkin_req.asset_id))
        unit = unit_result.scalars().first()
        if not unit:
            raise HTTPException(status_code=404, detail="Equipment unit not found")
        if unit.status != UnitStatusEnum.AVAILABLE:
            raise HTTPException(status_code=400, detail="Equipment unit is not available")

        # 2. Get the equipment model
        model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == unit.model_id))
        eq_model = model_result.scalars().first()
        
        # 3. Verify borrower
        borrower_result = await db.execute(select(User).where(User.id == walkin_req.borrower_id))
        borrower = borrower_result.scalars().first()
        if not borrower:
            raise HTTPException(status_code=404, detail="Borrower not found")

        # 4. Create the Request directly as ISSUED
        now = datetime.utcnow()
        new_request = Request(
            requester_id=walkin_req.borrower_id,
            model_id=eq_model.id,
            lab_id=eq_model.lab_id,
            required_from=now,
            required_until=walkin_req.due_date.replace(tzinfo=None),
            status=RequestStatusEnum.ISSUED
        )
        db.add(new_request)
        await db.flush() # flush to get new_request.id

        # 5. Create the Transaction as ACTIVE
        transaction = Transaction(
            request_id=new_request.id,
            unit_asset_id=unit.asset_id,
            borrower_id=walkin_req.borrower_id,
            lab_id=eq_model.lab_id,
            due_date=walkin_req.due_date.replace(tzinfo=None),
            status=TransactionStatusEnum.ACTIVE,
            issue_date=now
        )
        db.add(transaction)
        
        # 6. Update unit status
        unit.status = UnitStatusEnum.ISSUED

        await db.commit()
        await db.refresh(transaction)
        
        await create_notification(
            db=db,
            user_id=borrower.id,
            title="Walk-in Equipment Issued",
            message=f"Asset {unit.asset_id} was issued directly to you at the counter. Due on {walkin_req.due_date.strftime('%Y-%m-%d')}.",
            type=NotificationTypeEnum.INFO,
            category=NotificationCategoryEnum.CHECKOUT
        )
        
        return transaction
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        err = traceback.format_exc()
        raise HTTPException(status_code=500, detail=str(err))
