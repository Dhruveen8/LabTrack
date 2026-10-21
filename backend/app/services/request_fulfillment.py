"""Physical issue/return remain unit transactions under the existing request."""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select, func
from app.db.models import (RequestItem, RequestAllocation, Transaction, EquipmentUnit,
                           RequestStatusEnum as RS, TransactionStatusEnum as TS,
                           UnitStatusEnum as US, NotificationTypeEnum as NT,
                           NotificationCategoryEnum as NC, RequestKindEnum)
from app.services.lab_access import get_assistant_labs
from app.services.cart_requests import release_item, sync_request_status, request_response
from app.api.endpoints.notifications import create_notification
from app.services.approvals import stage, deadline


async def decide_items(db, request, items, assistant, approve):
    labs = await get_assistant_labs(db, assistant.id)
    owned = [item for item in items if item.lab_id in labs and item.status == RS.PENDING and stage(request, item) == 'ASSISTANT']
    if not any(item.lab_id in labs for item in items):
        raise HTTPException(403, 'No items in this request belong to your assigned labs')
    if not owned:
        raise HTTPException(400, 'No pending items in your assigned labs')
    if any(deadline(request, item) <= datetime.now(timezone.utc) for item in owned):
        raise HTTPException(409, 'This request has expired')
    for item in owned:
        item.status = RS.APPROVED if approve else RS.REJECTED
        if not approve:
            await release_item(db, item)
    await db.flush()
    await sync_request_status(db, request)
    request.decided_by_id = assistant.id
    request.decided_at = datetime.now(timezone.utc)
    request.approval_history = [*(request.approval_history or []), dict(stage='ASSISTANT', actor_id=assistant.id,
        actor_name=assistant.name, decision='APPROVED' if approve else 'REJECTED', at=request.decided_at.isoformat(),
        item_ids=[item.id for item in owned])]
    await create_notification(db, request.requester_id,
        'Request Approved' if approve else 'Request Rejected',
        f'Items from your request #{request.id} in this assistant’s labs have been '
        f'{"approved for pickup" if approve else "rejected and their reserved stock released"}.',
        NT.SUCCESS if approve else NT.ERROR, NC.REQUEST)
    await db.commit()
    return await request_response(db, request)


async def checkout_allocated(db, request, items, assistant, asset_id):
    if request.required_until <= datetime.now(timezone.utc):
        raise HTTPException(409, 'Return deadline has passed; this request cannot be issued')
    if request.kind == RequestKindEnum.QUICK_BORROW and datetime.now(timezone.utc) < request.required_from:
        raise HTTPException(400, 'Quick Borrow can only be issued on the selected day')
    unit = (await db.scalars(select(EquipmentUnit).where(EquipmentUnit.asset_id == asset_id).with_for_update())).first()
    if not unit:
        raise HTTPException(404, 'Equipment unit not found')
    labs = await get_assistant_labs(db, assistant.id)
    if unit.lab_id not in labs:
        raise HTTPException(403, 'Not authorized for this lab')
    allocation = await db.get(RequestAllocation, asset_id)
    item = next((item for item in items if allocation and item.id == allocation.request_item_id), None)
    if not item or unit.model_id != item.model_id or unit.lab_id != item.lab_id:
        raise HTTPException(409, 'This exact unit is not allocated to this request. Scan one of its reserved assets.')
    if item.status != RS.APPROVED or unit.status != US.RESERVED:
        raise HTTPException(409, 'The item is not approved or the unit has already been issued')
    if stage(request, item) != 'COLLECTION' or deadline(request, item) <= datetime.now(timezone.utc):
        raise HTTPException(409, 'The required approvals are incomplete or collection deadline has passed')
    if await db.scalar(select(Transaction.id).where(Transaction.unit_asset_id == asset_id, Transaction.status == TS.ACTIVE)):
        raise HTTPException(409, 'This physical unit already has an active loan')
    transaction = Transaction(request_id=request.id, request_item_id=item.id, unit_asset_id=asset_id,
        borrower_id=request.requester_id, lab_id=item.lab_id, due_date=request.required_until,
        status=TS.ACTIVE, is_quick_borrow=request.kind == RequestKindEnum.QUICK_BORROW, issued_by_id=assistant.id)
    unit.status = US.ISSUED
    db.add(transaction)
    await db.delete(allocation)
    await db.flush()
    count = await db.scalar(select(func.count(Transaction.id)).where(Transaction.request_item_id == item.id))
    if count >= item.quantity:
        item.status = RS.ISSUED
    await db.flush()
    await sync_request_status(db, request)
    await create_notification(db, request.requester_id, 'Equipment Checked Out',
        f'Asset {asset_id} has been issued to you. Due on {request.required_until.isoformat()}.',
        NT.INFO, NC.CHECKOUT, email_context={'kind': 'issued', 'transaction_ids': [transaction.id]})
    await db.commit()
    return transaction


async def sync_returned_item(db, request, transaction):
    item = await db.get(RequestItem, transaction.request_item_id)
    await db.flush()
    total, active = (await db.execute(select(func.count(Transaction.id),
        func.count(Transaction.id).filter(Transaction.status == TS.ACTIVE))
        .where(Transaction.request_item_id == item.id))).one()
    remaining = await db.scalar(select(func.count()).select_from(RequestAllocation).where(RequestAllocation.request_item_id == item.id))
    if total > 0 and active == 0 and not remaining:
        item.status = RS.RETURNED
    await db.flush()
    await sync_request_status(db, request)
