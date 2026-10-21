"""Approval gates are separate from per-lab fulfillment status."""
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import select
from app.db.models import (User, RoleEnum, AccountStatusEnum, RequestItem,
                           RequestStatusEnum as RS, LabAssistantAssignment,
                           NotificationTypeEnum as NT, NotificationCategoryEnum as NC)


def hod_pending(request):
    return bool(request.hod_id and not request.hod_approved_at and not any(
        entry.get('stage') == 'HOD' and entry.get('decision') in ('APPROVED', 'REJECTED')
        for entry in (request.approval_history or [])))


def stage(request, item):
    if item.status not in (RS.PENDING, RS.APPROVED):
        return item.status.value
    if request.faculty_id and not request.faculty_approved_at:
        return 'FACULTY'
    if hod_pending(request):
        return 'HOD'
    return 'COLLECTION' if item.status == RS.APPROVED else 'ASSISTANT'


def deadline(request, item):
    academic_pending = (request.faculty_id and not request.faculty_approved_at) or hod_pending(request)
    expires = request.approval_deadline if academic_pending else item.collection_deadline or request.approval_deadline
    return min(request.required_until, expires or request.required_until)


async def department_hod(db, department_id):
    hod = (await db.scalars(select(User).where(User.department_id == department_id,
        User.is_hod.is_(True), User.account_status == AccountStatusEnum.ACTIVE))).first()
    if not hod:
        raise HTTPException(409, 'Your department needs an active HOD before this request can be submitted')
    return hod


async def routing(db, user, faculty_id, needs_hod):
    faculty = None
    if user.role == RoleEnum.STUDENT:
        faculty = await db.get(User, faculty_id) if faculty_id else None
        if (not faculty or faculty.role != RoleEnum.FACULTY or faculty.is_hod
                or faculty.account_status != AccountStatusEnum.ACTIVE
                or not user.department_id or faculty.department_id != user.department_id):
            raise HTTPException(400, 'Select an active supervising faculty member from your own department')
    hod = await department_hod(db, user.department_id) if needs_hod and not user.is_hod else None
    return faculty, hod


async def notify(db, recipient, title, message):
    from app.api.endpoints.notifications import create_notification
    await create_notification(db, recipient, title, message, NT.INFO, NC.REQUEST)


async def notify_next(db, request, items):
    recipients = set()
    for item in items:
        current = stage(request, item)
        if current == 'FACULTY':
            recipients.add(request.faculty_id)
        elif current == 'HOD':
            recipients.add(request.hod_id)
        elif current == 'ASSISTANT':
            assistant = await db.scalar(select(LabAssistantAssignment.assistant_id).where(LabAssistantAssignment.lab_id == item.lab_id))
            if assistant:
                recipients.add(assistant)
    for recipient in sorted(recipients):
        await notify(db, recipient, 'Equipment request awaiting your approval', f'Review request #{request.id} in Requests.')


async def decide(db, request, actor, approve, reason):
    from app.services.cart_requests import release_item, sync_request_status, request_response
    now = datetime.now(timezone.utc)
    items = (await db.scalars(select(RequestItem).where(RequestItem.request_id == request.id).order_by(RequestItem.id))).all()
    if request.faculty_id == actor.id and not request.faculty_approved_at:
        name = 'FACULTY'
        selected = [item for item in items if stage(request, item) == name]
    elif actor.is_hod and request.hod_id == actor.id and hod_pending(request):
        name = 'HOD'
        selected = [item for item in items if stage(request, item) == name]
    else:
        raise HTTPException(403, 'You are not the current approver for this request')
    if not selected:
        raise HTTPException(409, 'No items await your approval')
    if any(deadline(request, item) <= now for item in selected):
        raise HTTPException(409, 'The seven-day approval deadline or return deadline has passed')
    if not approve and not (reason or '').strip():
        raise HTTPException(400, 'A rejection reason is required')
    affected = [item for item in selected if name != 'HOD' or approve or item.requires_hod_approval]
    request.approval_history = [*(request.approval_history or []), dict(stage=name, actor_id=actor.id,
        actor_name=actor.name, decision='APPROVED' if approve else 'REJECTED', reason=reason, at=now.isoformat(),
        item_ids=[item.id for item in affected])]
    if approve:
        setattr(request, 'faculty_approved_at' if name == 'FACULTY' else 'hod_approved_at', now)
    else:
        for item in affected:
            await release_item(db, item)
            item.status = RS.REJECTED
        request.rejection_reason = reason.strip()
    # A HOD decision releases the entire surviving request to fulfillment.
    # A rejection releases stock only for the HOD-required items.
    for item in items:
        if item.status in (RS.PENDING, RS.APPROVED) and stage(request, item) in ('ASSISTANT', 'COLLECTION'):
            if not item.collection_deadline or name == 'HOD':
                item.collection_deadline = min(now + timedelta(days=7), request.required_until)
    await db.flush()
    await sync_request_status(db, request)
    await notify(db, request.requester_id, f'{name.title()} decision',
        f'Request #{request.id}: ' + ('approved.' if approve else
            f'HOD-required equipment rejected: {reason.strip()}. Remaining items proceed to the lab assistant.'
            if name == 'HOD' and any(item.status == RS.PENDING for item in items)
            else f'rejected: {reason.strip()}.'))
    if approve or name == 'HOD':
        await notify_next(db, request, items)
    await db.commit()
    return await request_response(db, request)
