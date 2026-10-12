"""Draft carts do not allocate stock. Submission atomically holds physical units."""
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import select, func, delete
from app.db.models import (CartItem, EquipmentModel, EquipmentUnit, Lab, Request,
                           RequestItem, RequestAllocation, Transaction, User,
                           RoleEnum, RequestStatusEnum as RS, TransactionStatusEnum as TS,
                           UnitStatusEnum as US, RequestKindEnum, SystemSetting)
from app.schemas.borrowing import RequestResponse, RequestItemResponse


def free_units(model_id, lab_id):
    return select(EquipmentUnit).where(
        EquipmentUnit.model_id == model_id, EquipmentUnit.lab_id == lab_id,
        EquipmentUnit.status == US.AVAILABLE,
        ~select(Transaction.id).where(Transaction.unit_asset_id == EquipmentUnit.asset_id,
                                      Transaction.status == TS.ACTIVE).exists())


async def cart_snapshot(db, user_id):
    rows = (await db.execute(select(CartItem, EquipmentModel.name, Lab.name)
        .join(EquipmentModel, EquipmentModel.id == CartItem.model_id)
        .join(Lab, Lab.id == CartItem.lab_id).where(CartItem.user_id == user_id)
        .order_by(CartItem.model_id, CartItem.lab_id))).all()
    items = []
    for item, name, lab_name in rows:
        available = await db.scalar(select(func.count()).select_from(free_units(item.model_id, item.lab_id).subquery()))
        items.append(dict(model_id=item.model_id, lab_id=item.lab_id, equipment_name=name,
                          lab_name=lab_name, quantity=item.quantity, available_quantity=available,
                          unavailable=available == 0, insufficient=available < item.quantity))
    return dict(items=items, count=sum(item['quantity'] for item in items),
                can_submit=bool(items) and all(not item['insufficient'] for item in items))


async def request_response(db, request):
    response = RequestResponse.model_validate(request)
    rows = (await db.execute(select(RequestItem, EquipmentModel.name, Lab.name)
        .join(EquipmentModel, EquipmentModel.id == RequestItem.model_id)
        .join(Lab, Lab.id == RequestItem.lab_id).where(RequestItem.request_id == request.id)
        .order_by(RequestItem.id))).all()
    items = []
    for item, name, lab_name in rows:
        allocations = (await db.scalars(select(RequestAllocation.asset_id)
            .where(RequestAllocation.request_item_id == item.id).order_by(RequestAllocation.asset_id))).all()
        counts = (await db.execute(select(func.count(Transaction.id),
            func.count(Transaction.id).filter(Transaction.status == TS.RETURNED))
            .where(Transaction.request_item_id == item.id))).one()
        items.append(RequestItemResponse(id=item.id, model_id=item.model_id, equipment_name=name,
            lab_id=item.lab_id, lab_name=lab_name, quantity=item.quantity, status=item.status,
            reserved_asset_ids=list(allocations), issued_quantity=counts[0], returned_quantity=counts[1]))
    user = await db.get(User, request.requester_id)
    return response.model_copy(update={'items': items, 'requester_name': user.name,
                                      'requester_role': user.role.value})


async def sync_request_status(db, request):
    items = (await db.scalars(select(RequestItem).where(RequestItem.request_id == request.id))).all()
    if not items:
        return
    statuses = {item.status for item in items}
    active = await db.scalar(select(func.count(Transaction.id)).where(
        Transaction.request_id == request.id, Transaction.status == TS.ACTIVE))
    if RS.PENDING in statuses:
        request.status = RS.PENDING
    elif RS.APPROVED in statuses:
        request.status = RS.APPROVED
    elif active or RS.ISSUED in statuses:
        request.status = RS.ISSUED
    elif RS.RETURNED in statuses:
        request.status = RS.RETURNED
    elif RS.REJECTED in statuses:
        request.status = RS.REJECTED
        request.rejection_reason = 'Requested items were rejected by their lab assistants'
    else:
        request.status = RS.CANCELLED


async def validate_policy(db, user, start, due, quantity):
    now = datetime.now(timezone.utc)
    if due <= start or due <= now:
        raise HTTPException(400, 'Return deadline must be in the future and after the start date')
    values = {row.key: int(row.value) for row in (await db.scalars(select(SystemSetting)
        .where(SystemSetting.key.in_(['STUDENT_MAX_ITEMS', 'STUDENT_MAX_BORROW_DAYS', 'FACULTY_MAX_BORROW_DAYS'])))).all()}
    max_days = values.get('STUDENT_MAX_BORROW_DAYS', 14) if user.role == RoleEnum.STUDENT else values.get('FACULTY_MAX_BORROW_DAYS', 30)
    if due - start > timedelta(days=max_days):
        raise HTTPException(400, f'Borrowing duration cannot exceed {max_days} days')
    if user.role == RoleEnum.STUDENT:
        active = await db.scalar(select(func.count(Transaction.id)).where(Transaction.borrower_id == user.id, Transaction.status == TS.ACTIVE))
        pending = (await db.scalars(select(Request).where(Request.requester_id == user.id,
                    Request.status.in_([RS.PENDING, RS.APPROVED])))).all()
        outstanding = 0
        for request in pending:
            # Partial pickups and returns must not double-count units already issued.
            issued = await db.scalar(select(func.count(Transaction.id)).where(Transaction.request_id == request.id))
            rejected = await db.scalar(select(func.coalesce(func.sum(RequestItem.quantity), 0)).where(
                RequestItem.request_id == request.id, RequestItem.status == RS.REJECTED))
            outstanding += max(0, request.quantity - issued - rejected)
        limit = values.get('STUDENT_MAX_ITEMS', 3)
        if active + outstanding + quantity > limit:
            raise HTTPException(400, f'Students cannot have more than {limit} borrowed or pending items')


async def allocate_request(db, user, selections, start, due, purpose, *, key=None,
                           kind=RequestKindEnum.STANDARD, clear_cart=False):
    if user.role not in (RoleEnum.STUDENT, RoleEnum.FACULTY):
        raise HTTPException(403, 'Only students and faculty may request equipment')
    # One borrower cannot evade their item limit with concurrent submissions.
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    start = start if start.tzinfo else start.replace(tzinfo=timezone.utc)
    due = due if due.tzinfo else due.replace(tzinfo=timezone.utc)
    if key:
        existing = (await db.scalars(select(Request).where(Request.submission_key == key))).first()
        if existing:
            if existing.requester_id != user.id:
                raise HTTPException(409, 'Submission key already used')
            previous = (await db.scalars(select(RequestItem).where(RequestItem.request_id == existing.id))).all()
            before = sorted((item.model_id, item.lab_id, item.quantity) for item in previous)
            after = sorted((item.model_id, item.lab_id, item.quantity) for item in selections)
            if (before != after or existing.required_from != start or existing.required_until != due
                    or existing.purpose != purpose or existing.kind != kind):
                raise HTTPException(409, 'Submission key was already used for a different request')
            return existing
    await validate_policy(db, user, start, due, sum(item.quantity for item in selections))
    ordered = sorted(selections, key=lambda item: (item.model_id, item.lab_id))
    if clear_cart:
        saved = (await db.scalars(select(CartItem).where(CartItem.user_id == user.id))).all()
        expected = {(item.model_id, item.lab_id): item.quantity for item in selections}
        actual = {(item.model_id, item.lab_id): item.quantity for item in saved}
        if actual != expected:
            raise HTTPException(409, {'code': 'CART_CHANGED', 'message': 'Your cart changed. Review it again before submitting.'})
    allocations = []
    shortages = []
    for item in ordered:
        model = await db.get(EquipmentModel, item.model_id)
        lab = await db.get(Lab, item.lab_id)
        if not model or not lab:
            raise HTTPException(404, 'Equipment type or lab no longer exists')
        units = (await db.scalars(free_units(item.model_id, item.lab_id)
            .order_by(EquipmentUnit.asset_id).with_for_update(skip_locked=True)
            .limit(item.quantity))).all()
        if len(units) < item.quantity:
            shortages.append(dict(model_id=item.model_id, lab_id=item.lab_id,
                                  equipment_name=model.name, requested_quantity=item.quantity,
                                  available_quantity=len(units)))
        allocations.append((item, units))
    if shortages:
        raise HTTPException(409, {'code': 'INSUFFICIENT_STOCK',
            'message': 'Some items are unavailable or being allocated. No items were requested. Revise your cart.',
            'items': shortages})
    # Legacy model/lab columns remain the first item's references for compatibility.
    # request_items is authoritative for combined requests and per-lab authorization.
    first = ordered[0]
    request = Request(requester_id=user.id, model_id=first.model_id, lab_id=first.lab_id,
        quantity=sum(item.quantity for item in ordered), required_from=start, required_until=due,
        kind=kind, purpose=purpose, submission_key=key, status=RS.PENDING)
    db.add(request)
    await db.flush()
    for selected, units in allocations:
        item = RequestItem(request_id=request.id, model_id=selected.model_id,
                           lab_id=selected.lab_id, quantity=selected.quantity, status=RS.PENDING)
        db.add(item)
        await db.flush()
        for unit in units:
            unit.status = US.RESERVED
            db.add(RequestAllocation(asset_id=unit.asset_id, request_item_id=item.id))
    if clear_cart:
        await db.execute(delete(CartItem).where(CartItem.user_id == user.id))
    await db.flush()
    return request


async def release_item(db, item):
    assets = (await db.scalars(select(RequestAllocation.asset_id).where(RequestAllocation.request_item_id == item.id))).all()
    if assets:
        units = (await db.scalars(select(EquipmentUnit).where(EquipmentUnit.asset_id.in_(assets))
            .order_by(EquipmentUnit.asset_id).with_for_update())).all()
        for unit in units:
            if unit.status == US.RESERVED:
                unit.status = US.AVAILABLE
        await db.execute(delete(RequestAllocation).where(RequestAllocation.request_item_id == item.id))


async def expire_allocations(now=None):
    """Release uncollected items after the request deadline, once per item."""
    from app.db.database import AsyncSessionLocal
    from app.api.endpoints.notifications import create_notification
    from app.db.models import NotificationTypeEnum, NotificationCategoryEnum
    now = now or datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        requests = (await db.scalars(select(Request).where(Request.required_until <= now,
            select(RequestItem.id).where(RequestItem.request_id == Request.id,
                                         RequestItem.status.in_([RS.PENDING, RS.APPROVED])).exists())
            .order_by(Request.id).with_for_update(skip_locked=True))).all()
        for request in requests:
            items = (await db.scalars(select(RequestItem).where(RequestItem.request_id == request.id,
                                                       RequestItem.status.in_([RS.PENDING, RS.APPROVED])))).all()
            for item in items:
                await release_item(db, item)
                item.status = RS.CANCELLED
            await db.flush()
            await sync_request_status(db, request)
            await create_notification(db, request.requester_id, 'Uncollected Request Items Expired',
                f'Uncollected items in request #{request.id} expired at their return deadline. Their reserved stock has been released.',
                NotificationTypeEnum.WARNING, NotificationCategoryEnum.REQUEST)
        await db.commit()
