from app.services.lab_access import get_assistant_labs
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta, timezone

from app.db.database import get_db
from app.db.models import (
    Request,
    Transaction,
    EquipmentModel,
    EquipmentUnit,
    RoleEnum,
    User,
    RequestStatusEnum,
    TransactionStatusEnum,
    UnitStatusEnum,
    EquipmentTypeEnum,
    NotificationTypeEnum,
    NotificationCategoryEnum,
    SystemSetting,
    ExtensionRequest as ExtensionRequestORM,
    ExtensionStatusEnum,
    EventIssue,
    RequestKindEnum,
)
# Schema ExtensionRequest is the Pydantic request-body type
from app.schemas.borrowing import (
    RequestCreate, RequestResponse, CheckoutRequest, ReturnRequest,
    TransactionResponse, ExtensionRequest as ExtensionRequestSchema,
    QuickBorrowRequest, WalkInIssueRequest, EventIssueCreate
)
from app.api.deps import get_current_user, require_role
from app.api.endpoints.notifications import create_notification

router = APIRouter()


async def named_responses(db, records, schema, id_field, name_field, role_field):
    """Enrich only records already selected by the caller's access scope."""
    ids = {getattr(record, id_field) for record in records}
    if not ids:
        return []
    users = (await db.execute(select(User.id, User.name, User.role).where(User.id.in_(ids)))).all()
    names = {user.id: user for user in users}
    return [schema.model_validate(record).model_copy(update={
        name_field: names[getattr(record, id_field)].name,
        role_field: names[getattr(record, id_field)].role.value,
    }) for record in records]


@router.post("/requests", response_model=RequestResponse)
async def create_request(
    req_in: RequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [RoleEnum.STUDENT, RoleEnum.FACULTY]:
        raise HTTPException(status_code=403, detail="Only students and faculty can make reservations")

    if req_in.kind not in (None, RequestKindEnum.STANDARD):
        raise HTTPException(status_code=400, detail='Use the counter or event issue workflow for this request kind')

    # Normalize before comparing: date-only and timestamp inputs can be mixed.
    req_from = req_in.required_from if req_in.required_from.tzinfo else req_in.required_from.replace(tzinfo=timezone.utc)
    req_until = req_in.required_until if req_in.required_until.tzinfo else req_in.required_until.replace(tzinfo=timezone.utc)
    if req_until <= req_from:
        raise HTTPException(status_code=400, detail="required_until must be after required_from")

    if req_in.quantity is not None and req_in.quantity < 1:
        raise HTTPException(status_code=400, detail="quantity must be at least 1")

    delta = req_until - req_from

    # Get settings
    settings_res = await db.execute(
        select(SystemSetting).where(
            SystemSetting.key.in_(["STUDENT_MAX_BORROW_DAYS", "FACULTY_MAX_BORROW_DAYS", "STUDENT_MAX_ITEMS"])
        )
    )
    settings_dict = {s.key: int(s.value) for s in settings_res.scalars().all()}

    max_student_days = settings_dict.get("STUDENT_MAX_BORROW_DAYS", 14)
    max_faculty_days = settings_dict.get("FACULTY_MAX_BORROW_DAYS", 30)
    max_student_items = settings_dict.get("STUDENT_MAX_ITEMS", 3)

    if current_user.role == RoleEnum.STUDENT and delta > timedelta(days=max_student_days):
        raise HTTPException(status_code=400, detail=f"Students can borrow for a maximum of {max_student_days} days")
    if current_user.role == RoleEnum.FACULTY and delta > timedelta(days=max_faculty_days):
        raise HTTPException(status_code=400, detail=f"Faculty can borrow for a maximum of {max_faculty_days} days")

    # Enforce max concurrent items for students — count active transactions, not just requests
    if current_user.role == RoleEnum.STUDENT:
        active_count_res = await db.execute(
            select(func.count(Transaction.id))
            .where(Transaction.borrower_id == current_user.id)
            .where(Transaction.status == TransactionStatusEnum.ACTIVE)
        )
        active_count = active_count_res.scalar() or 0
        # Also count pending/approved requests not yet issued
        pending_req_res = await db.execute(
            select(func.sum(Request.quantity))
            .where(Request.requester_id == current_user.id)
            .where(Request.status.in_([RequestStatusEnum.PENDING, RequestStatusEnum.APPROVED]))
        )
        pending_qty = pending_req_res.scalar() or 0
        total_active = active_count + pending_qty + (req_in.quantity or 1)
        if total_active > max_student_items:
            raise HTTPException(
                status_code=400,
                detail=f"Students cannot have more than {max_student_items} active borrowed/pending items simultaneously."
            )

    # Check equipment exists
    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == req_in.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")

    new_request = Request(
        requester_id=current_user.id,
        model_id=req_in.model_id,
        lab_id=eq_model.lab_id,
        required_from=req_from,
        required_until=req_until,
        status=RequestStatusEnum.PENDING,
        kind=req_in.kind or RequestKindEnum.STANDARD,
        quantity=req_in.quantity or 1,
        purpose=req_in.purpose
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
    lab_ids = await get_assistant_labs(db, current_user.id)
    if not lab_ids:
        return []
    result = await db.execute(
        select(Request)
        .where(Request.lab_id.in_(lab_ids))
        .where(Request.status == RequestStatusEnum.PENDING)
    )
    return await named_responses(db, result.scalars().all(), RequestResponse, "requester_id", "requester_name", "requester_role")


@router.get("/requests", response_model=List[RequestResponse])
async def list_all_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == RoleEnum.ADMIN:
        result = await db.execute(select(Request))
    elif current_user.role == RoleEnum.ASSISTANT:
        lab_ids = await get_assistant_labs(db, current_user.id)
        if not lab_ids:
            return []
        result = await db.execute(select(Request).where(Request.lab_id.in_(lab_ids)))
    else:
        result = await db.execute(select(Request).where(Request.requester_id == current_user.id))
    return await named_responses(db, result.scalars().all(), RequestResponse, "requester_id", "requester_name", "requester_role")


@router.get("/transactions", response_model=List[TransactionResponse])
async def list_all_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == RoleEnum.ADMIN:
        result = await db.execute(select(Transaction))
    elif current_user.role == RoleEnum.ASSISTANT:
        lab_ids = await get_assistant_labs(db, current_user.id)
        if not lab_ids:
            return []
        result = await db.execute(select(Transaction).where(Transaction.lab_id.in_(lab_ids)))
    else:
        result = await db.execute(select(Transaction).where(Transaction.borrower_id == current_user.id))
    return await named_responses(db, result.scalars().all(), TransactionResponse, "borrower_id", "borrower_name", "borrower_role")


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

    # FIX: Guard against invalid state transitions — only PENDING can be approved
    if req.status != RequestStatusEnum.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve a request that is in '{req.status}' state. Only PENDING requests can be approved."
        )

    lab_ids = await get_assistant_labs(db, current_user.id)
    if req.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized to approve for this lab")

    req.status = RequestStatusEnum.APPROVED
    req.decided_by_id = current_user.id
    req.decided_at = datetime.now(timezone.utc)
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
    await db.commit()

    return req


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

    # FIX: Guard against invalid state transitions — only PENDING can be rejected
    if req.status != RequestStatusEnum.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject a request that is in '{req.status}' state. Only PENDING requests can be rejected."
        )

    lab_ids = await get_assistant_labs(db, current_user.id)
    if req.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")

    req.status = RequestStatusEnum.REJECTED
    req.decided_by_id = current_user.id
    req.decided_at = datetime.now(timezone.utc)
    req.rejection_reason = "Rejected by lab assistant"
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
    await db.commit()

    return req


@router.post("/requests/{request_id}/extend", response_model=RequestResponse)
async def request_extension(
    request_id: int,
    ext_in: ExtensionRequestSchema,  # FIX: use aliased schema name
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

    # FIX: Normalize datetimes to be timezone-aware before comparison
    new_due = ext_in.new_due_date
    if new_due.tzinfo is None:
        new_due = new_due.replace(tzinfo=timezone.utc)

    req_from = req.required_from
    if req_from.tzinfo is None:
        req_from = req_from.replace(tzinfo=timezone.utc)

    total_delta = new_due - req_from

    if current_user.role == RoleEnum.STUDENT and total_delta.days > 14:
        raise HTTPException(status_code=400, detail="Total borrowing period including extension cannot exceed 14 days for students.")
    if current_user.role == RoleEnum.FACULTY and total_delta.days > 30:
        raise HTTPException(status_code=400, detail="Total borrowing period including extension cannot exceed 30 days for faculty.")

    # Find active transaction(s)
    active_trans_res = await db.execute(
        select(Transaction)
        .where(Transaction.request_id == request_id)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )
    active_trans = active_trans_res.scalars().first()
    if not active_trans:
        raise HTTPException(status_code=400, detail="No active transaction to extend")

    # FIX: Use ORM alias to create an ExtensionRequest DB row
    ext_orm = ExtensionRequestORM(
        request_id=request_id,
        requested_by_id=current_user.id,
        current_due_date=active_trans.due_date,
        requested_due_date=new_due,
        reason=ext_in.reason,
        status=ExtensionStatusEnum.PENDING
    )
    db.add(ext_orm)
    await db.commit()
    await db.refresh(req)
    return req


@router.post("/requests/{request_id}/approve-extension", response_model=RequestResponse)
async def approve_extension(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    """Assistant approves extension, updates ALL active transaction due_dates."""
    req_result = await db.execute(select(Request).where(Request.id == request_id))
    req = req_result.scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    lab_ids = await get_assistant_labs(db, current_user.id)
    if req.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")

    # FIX: Corrected predicate — query for PENDING status only, no malformed comparisons
    ext_res = await db.execute(
        select(ExtensionRequestORM)
        .where(ExtensionRequestORM.request_id == request_id)
        .where(ExtensionRequestORM.status == ExtensionStatusEnum.PENDING)
    )
    ext_req = ext_res.scalars().first()
    if not ext_req:
        raise HTTPException(status_code=400, detail="No pending extension for this request")

    # FIX: Update ALL active transactions, not just the first one
    trans_result = await db.execute(
        select(Transaction)
        .where(Transaction.request_id == request_id)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )
    transactions = trans_result.scalars().all()
    for transaction in transactions:
        transaction.due_date = ext_req.requested_due_date
        transaction.reissued_count += 1

    ext_req.status = ExtensionStatusEnum.APPROVED
    ext_req.decided_by_id = current_user.id
    ext_req.decided_at = datetime.now(timezone.utc)
    req.required_until = ext_req.requested_due_date
    await db.commit()
    await db.refresh(req)

    await create_notification(
        db=db,
        user_id=req.requester_id,
        title="Extension Approved",
        message=f"Your extension for request #{req.id} is approved. New due date is {req.required_until.strftime('%d-%m-%Y')}.",
        type=NotificationTypeEnum.SUCCESS,
        category=NotificationCategoryEnum.EXTENSION
    )
    await db.commit()

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

    lab_ids = await get_assistant_labs(db, current_user.id)
    if req.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")

    unit_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == checkout_req.asset_id))
    unit = unit_result.scalars().first()

    if not unit:
        raise HTTPException(status_code=404, detail="Equipment unit not found")
    if unit.model_id != req.model_id:
        raise HTTPException(status_code=400, detail="QR code asset does not match the requested equipment model")

    # FIX: Validate that the unit physically belongs to the request's lab (transfers move lab_id)
    if unit.lab_id != req.lab_id:
        raise HTTPException(
            status_code=400,
            detail=f"Unit {unit.asset_id} currently belongs to lab {unit.lab_id}, not the request's lab {req.lab_id}"
        )

    if unit.status != UnitStatusEnum.AVAILABLE:
        raise HTTPException(status_code=400, detail="Equipment unit is not available")

    # Count active transactions for this request
    tx_count_res = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.request_id == req.id)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )
    current_count = tx_count_res.scalar() or 0

    unit.status = UnitStatusEnum.ISSUED
    if current_count + 1 >= req.quantity:
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
        message=f"Asset {unit.asset_id} has been issued to you. Due on {req.required_until.strftime('%d-%m-%Y')}.",
        type=NotificationTypeEnum.INFO,
        category=NotificationCategoryEnum.CHECKOUT
    )
    await db.commit()

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

    lab_ids = await get_assistant_labs(db, current_user.id)
    if transaction.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")

    # Update transaction
    transaction.status = TransactionStatusEnum.RETURNED
    transaction.return_date = datetime.now(timezone.utc)

    # Store condition in dedicated fields
    transaction.return_condition = ret_req.condition_remarks
    transaction.return_remarks = ret_req.condition_remarks

    # FIX: Route damaged units to MAINTENANCE instead of blindly making them AVAILABLE
    condition_lower = (ret_req.condition_remarks or "").lower()
    damaged_keywords = ["damage", "broken", "unusable", "repair", "fault", "defect", "malfunction"]
    if any(kw in condition_lower for kw in damaged_keywords):
        unit.status = UnitStatusEnum.MAINTENANCE
    else:
        unit.status = UnitStatusEnum.AVAILABLE

    unit.condition = ret_req.condition_remarks or unit.condition

    # FIX: Only mark request RETURNED when ALL transactions for it are returned
    remaining_active_res = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.request_id == transaction.request_id)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
        # The current transaction is not yet committed as RETURNED in this count
        .where(Transaction.id != transaction.id)
    )
    remaining_active = remaining_active_res.scalar() or 0

    if remaining_active == 0 and req:
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
    await db.commit()

    return transaction


@router.post("/quick-borrow", response_model=TransactionResponse)
async def quick_borrow(
    quick_req: QuickBorrowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    """Quick-borrow flow: assistant scans student ID + equipment QR, auto-issues."""
    unit_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == quick_req.asset_id))
    unit = unit_result.scalars().first()
    if not unit:
        raise HTTPException(status_code=404, detail="Equipment unit not found")
    if unit.status != UnitStatusEnum.AVAILABLE:
        raise HTTPException(status_code=400, detail="Equipment unit is not available")

    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == unit.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model or eq_model.equipment_type != EquipmentTypeEnum.QUICK_BORROW:
        raise HTTPException(status_code=400, detail="This equipment is not configured for quick-borrow")

    lab_ids = await get_assistant_labs(db, current_user.id)
    # FIX: Check unit's current lab, not model's original lab
    if unit.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")

    borrower_result = await db.execute(select(User).where(User.id == quick_req.borrower_id))
    borrower = borrower_result.scalars().first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    if borrower.role != RoleEnum.FACULTY:
        raise HTTPException(status_code=403, detail="Only faculty members can borrow equipment daily via Quick Borrow")

    # Use institution's local timezone end-of-day (UTC+5:30 for India)
    from datetime import timezone as tz
    import zoneinfo
    try:
        IST = zoneinfo.ZoneInfo("Asia/Kolkata")
        now_ist = datetime.now(IST)
        end_of_today_ist = now_ist.replace(hour=23, minute=59, second=59, microsecond=0)
        # Convert back to UTC for storage
        end_of_today = end_of_today_ist.astimezone(timezone.utc)
    except Exception:
        # Fallback if zoneinfo not available
        now = datetime.now(timezone.utc)
        # IST is UTC+5:30, so end-of-day IST 23:59 = UTC 18:29
        end_of_today = now.replace(hour=18, minute=29, second=59, microsecond=0)

    now = datetime.now(timezone.utc)

    new_request = Request(
        requester_id=quick_req.borrower_id,
        model_id=eq_model.id,
        lab_id=unit.lab_id,
        required_from=now,
        required_until=end_of_today,
        status=RequestStatusEnum.ISSUED,
        kind=RequestKindEnum.QUICK_BORROW
    )
    db.add(new_request)
    await db.flush()

    unit.status = UnitStatusEnum.ISSUED

    transaction = Transaction(
        request_id=new_request.id,
        unit_asset_id=unit.asset_id,
        borrower_id=quick_req.borrower_id,
        lab_id=unit.lab_id,
        due_date=end_of_today,
        status=TransactionStatusEnum.ACTIVE,
        is_quick_borrow=True
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


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

    lab_ids = await get_assistant_labs(db, current_user.id)
    if transaction.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")

    transaction.status = TransactionStatusEnum.RETURNED
    transaction.return_date = datetime.now(timezone.utc)
    unit.status = UnitStatusEnum.AVAILABLE
    if req:
        req.status = RequestStatusEnum.RETURNED

    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.get("/quick-borrow/stats")
async def quick_borrow_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    """Returns quick-borrow stats for the assistant's assigned labs."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # FIX: Scope stats to the assistant's assigned labs
    lab_ids = await get_assistant_labs(db, current_user.id)
    if not lab_ids:
        return {"currentlyOut": 0, "returnedToday": 0, "overdue": 0}

    out_result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.is_quick_borrow == True)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
        .where(Transaction.lab_id.in_(lab_ids))
    )
    currently_out = out_result.scalar() or 0

    returned_result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.is_quick_borrow == True)
        .where(Transaction.status == TransactionStatusEnum.RETURNED)
        .where(Transaction.return_date >= today_start)
        .where(Transaction.lab_id.in_(lab_ids))
    )
    returned_today = returned_result.scalar() or 0

    overdue_result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.is_quick_borrow == True)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
        .where(Transaction.due_date < datetime.now(timezone.utc))
        .where(Transaction.lab_id.in_(lab_ids))
    )
    overdue = overdue_result.scalar() or 0

    return {
        "currentlyOut": currently_out,
        "returnedToday": returned_today,
        "overdue": overdue
    }


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

        model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == unit.model_id))
        eq_model = model_result.scalars().first()

        # FIX: Check unit's current lab, not model's original lab
        lab_ids = await get_assistant_labs(db, current_user.id)
        if unit.lab_id not in lab_ids:
            raise HTTPException(status_code=403, detail="Not authorized for this lab")

        borrower_result = await db.execute(select(User).where(User.id == walkin_req.borrower_id))
        borrower = borrower_result.scalars().first()
        if not borrower:
            raise HTTPException(status_code=404, detail="Borrower not found")

        # Normalize due_date to be timezone-aware
        due_date = walkin_req.due_date
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)

        if due_date <= now:
            raise HTTPException(status_code=400, detail="Due date must be in the future")

        # Get settings and enforce duration limits
        settings_res = await db.execute(
            select(SystemSetting).where(
                SystemSetting.key.in_(["STUDENT_MAX_BORROW_DAYS", "FACULTY_MAX_BORROW_DAYS"])
            )
        )
        settings_dict = {s.key: int(s.value) for s in settings_res.scalars().all()}
        max_student_days = settings_dict.get("STUDENT_MAX_BORROW_DAYS", 14)
        max_faculty_days = settings_dict.get("FACULTY_MAX_BORROW_DAYS", 30)

        duration_days = (due_date - now).days
        if borrower.role == RoleEnum.STUDENT and duration_days > max_student_days:
            raise HTTPException(status_code=400, detail=f"Students can borrow for a maximum of {max_student_days} days")
        if borrower.role == RoleEnum.FACULTY and duration_days > max_faculty_days:
            raise HTTPException(status_code=400, detail=f"Faculty can borrow for a maximum of {max_faculty_days} days")

        new_request = Request(
            requester_id=walkin_req.borrower_id,
            model_id=eq_model.id,
            lab_id=unit.lab_id,
            required_from=now,
            required_until=due_date,
            status=RequestStatusEnum.ISSUED,
            kind=RequestKindEnum.WALK_IN
        )
        db.add(new_request)
        await db.flush()

        transaction = Transaction(
            request_id=new_request.id,
            unit_asset_id=unit.asset_id,
            borrower_id=walkin_req.borrower_id,
            lab_id=unit.lab_id,
            due_date=due_date,
            status=TransactionStatusEnum.ACTIVE,
            issue_date=now
        )
        db.add(transaction)
        unit.status = UnitStatusEnum.ISSUED

        await db.commit()
        await db.refresh(transaction)

        await create_notification(
            db=db,
            user_id=borrower.id,
            title="Walk-in Equipment Issued",
            message=f"Asset {unit.asset_id} was issued directly to you at the counter. Due on {due_date.strftime('%d-%m-%Y')}.",
            type=NotificationTypeEnum.INFO,
            category=NotificationCategoryEnum.CHECKOUT
        )
        await db.commit()

        return transaction
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def issue_approved_event(event_req: EventIssueCreate, db: AsyncSession, current_user: User):
    if not event_req.unit_asset_ids:
        raise HTTPException(status_code=400, detail="No units specified")

    units_result = await db.execute(
        select(EquipmentUnit).where(EquipmentUnit.asset_id.in_(event_req.unit_asset_ids))
        .order_by(EquipmentUnit.asset_id).with_for_update()
    )
    units = units_result.scalars().all()
    if len(units) != len(event_req.unit_asset_ids):
        raise HTTPException(status_code=404, detail="One or more equipment units not found")

    lab_ids = await get_assistant_labs(db, current_user.id)

    event_lab_id = units[0].lab_id
    if event_lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")

    models_needed = {}

    for u in units:
        if u.status != UnitStatusEnum.AVAILABLE:
            raise HTTPException(status_code=400, detail=f"Unit {u.asset_id} is not AVAILABLE")
        if u.lab_id != event_lab_id:
            raise HTTPException(status_code=400, detail="All units in an event issue must belong to the same lab")
        models_needed[u.model_id] = models_needed.get(u.model_id, 0) + 1

    coordinator_res = await db.execute(select(User).where(User.id == event_req.coordinator_id))
    coordinator = coordinator_res.scalars().first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Coordinator not found")
    if coordinator.role != RoleEnum.FACULTY or coordinator.account_status.value != 'ACTIVE':
        raise HTTPException(status_code=400, detail='Coordinator must be an active faculty member')

    now = datetime.now(timezone.utc)
    due_date = event_req.due_date
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)
    if due_date <= now:
        raise HTTPException(status_code=400, detail='Return date must be in the future')

    event_issue = EventIssue(
        event_name=event_req.event_name,
        purpose=event_req.purpose,
        coordinator_id=event_req.coordinator_id,
        lab_id=event_lab_id,
        issued_by_id=current_user.id,
        issue_date=now,
        due_date=due_date
    )
    db.add(event_issue)
    await db.flush()

    requests_map = {}
    for model_id, qty in models_needed.items():
        req = Request(
            requester_id=event_req.coordinator_id,
            model_id=model_id,
            lab_id=event_lab_id,
            kind=RequestKindEnum.EVENT,
            quantity=qty,
            purpose=event_req.purpose,
            required_from=now,
            required_until=event_issue.due_date,
            status=RequestStatusEnum.ISSUED,
            event_issue_id=event_issue.id
        )
        db.add(req)
        await db.flush()
        requests_map[model_id] = req.id

    for u in units:
        u.status = UnitStatusEnum.ISSUED
        tx = Transaction(
            request_id=requests_map[u.model_id],
            unit_asset_id=u.asset_id,
            borrower_id=event_req.coordinator_id,
            lab_id=event_lab_id,
            issue_date=now,
            due_date=event_issue.due_date,
            status=TransactionStatusEnum.ACTIVE,
            issued_by_id=current_user.id
        )
        db.add(tx)

    await create_notification(
        db=db,
        user_id=event_req.coordinator_id,
        title="Event Equipment Issued",
        message=f"Equipment for event '{event_issue.event_name}' was successfully issued. Due on {event_issue.due_date.strftime('%d-%m-%Y')}.",
        type=NotificationTypeEnum.INFO,
        category=NotificationCategoryEnum.CHECKOUT
    )
    await db.flush()
    return event_issue
