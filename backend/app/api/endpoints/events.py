"""Faculty event requests; only the assigned assistant can approve and issue."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.api.endpoints.borrowing import issue_approved_event
from app.api.endpoints.notifications import create_notification
from app.db.database import get_db
from app.db.models import (EventRequest, EquipmentUnit, LabAssistantAssignment, User, RoleEnum,
                          UnitStatusEnum, NotificationTypeEnum, NotificationCategoryEnum)
from app.schemas.borrowing import EventIssueCreate
from app.services.lab_access import get_assistant_labs

router = APIRouter()


class EventRequestCreate(BaseModel):
    event_name: str = Field(min_length=1, max_length=200)
    purpose: str = Field(min_length=1)
    due_date: datetime
    unit_asset_ids: list[str] = Field(min_length=1, max_length=1000)
    coordinator_id: Optional[int] = None

    @field_validator('event_name', 'purpose')
    @classmethod
    def required_text(cls, value):
        if not value.strip():
            raise ValueError('This field is required')
        return value.strip()

    @field_validator('unit_asset_ids')
    @classmethod
    def valid_assets(cls, values):
        values = [value.strip() for value in values]
        if any(not value for value in values) or len(set(values)) != len(values):
            raise ValueError('Asset IDs must be nonempty and unique')
        return values


class EventRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_name: str
    purpose: str
    coordinator_id: int
    coordinator_name: Optional[str] = None
    lab_id: int
    unit_asset_ids: list[str]
    due_date: datetime
    status: str
    created_at: datetime
    decided_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    event_issue_id: Optional[int] = None


class Rejection(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


@router.post('/requests', response_model=EventRequestResponse)
@router.post('/issue', response_model=EventRequestResponse, deprecated=True)
async def submit_request(payload: EventRequestCreate, db: AsyncSession = Depends(get_db),
                         user: User = Depends(require_role(RoleEnum.FACULTY))):
    if payload.coordinator_id is not None and payload.coordinator_id != user.id:
        raise HTTPException(status_code=403, detail='You can only request equipment for an event you coordinate')
    due = payload.due_date if payload.due_date.tzinfo else payload.due_date.replace(tzinfo=timezone.utc)
    if due <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail='Return date must be in the future')
    units = (await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id.in_(payload.unit_asset_ids)))).scalars().all()
    if len(units) != len(payload.unit_asset_ids):
        raise HTTPException(status_code=404, detail='One or more equipment units not found')
    lab_id = units[0].lab_id
    if any(unit.lab_id != lab_id for unit in units):
        raise HTTPException(status_code=400, detail='All equipment must belong to the same lab')
    if any(unit.status != UnitStatusEnum.AVAILABLE for unit in units):
        raise HTTPException(status_code=400, detail='One or more equipment units are unavailable')
    assistant_id = (await db.execute(select(LabAssistantAssignment.assistant_id)
                                   .where(LabAssistantAssignment.lab_id == lab_id))).scalar_one_or_none()
    assistant = await db.get(User, assistant_id) if assistant_id else None
    if not assistant or assistant.account_status.value != 'ACTIVE':
        raise HTTPException(status_code=400, detail='This lab needs an active assigned assistant before you can submit a request')
    request = EventRequest(event_name=payload.event_name, purpose=payload.purpose,
                           coordinator_id=user.id, lab_id=lab_id, unit_asset_ids=payload.unit_asset_ids, due_date=due)
    db.add(request)
    await db.flush()
    await create_notification(db, assistant_id, 'Event Request Pending',
        f'{user.name} requested {len(units)} units for {request.event_name}. Review it in Event / Club Requests.',
        NotificationTypeEnum.INFO, NotificationCategoryEnum.REQUEST)
    await db.commit()
    return request


@router.get('/requests', response_model=list[EventRequestResponse])
async def list_requests(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(EventRequest).order_by(EventRequest.created_at.desc())
    if user.role == RoleEnum.FACULTY:
        query = query.where(EventRequest.coordinator_id == user.id)
    elif user.role == RoleEnum.ASSISTANT:
        query = query.where(EventRequest.lab_id.in_(await get_assistant_labs(db, user.id)))
    elif user.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=403, detail='Not authorized')
    rows = (await db.execute(query)).scalars().all()
    names = dict((await db.execute(select(User.id, User.name).where(User.id.in_({row.coordinator_id for row in rows})))).all())
    return [EventRequestResponse.model_validate(row).model_copy(update={'coordinator_name': names.get(row.coordinator_id)}) for row in rows]


async def pending_request(db, request_id, assistant):
    request = (await db.execute(select(EventRequest).where(EventRequest.id == request_id).with_for_update())).scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail='Event request not found')
    if request.lab_id not in await get_assistant_labs(db, assistant.id):
        raise HTTPException(status_code=403, detail='Not authorized for this lab')
    if request.status != 'PENDING':
        raise HTTPException(status_code=409, detail='This event request has already been decided')
    return request


@router.post('/requests/{request_id}/approve', response_model=EventRequestResponse)
async def approve(request_id: int, db: AsyncSession = Depends(get_db),
                  user: User = Depends(require_role(RoleEnum.ASSISTANT))):
    request = await pending_request(db, request_id, user)
    try:
        event = await issue_approved_event(EventIssueCreate(event_name=request.event_name, purpose=request.purpose,
            coordinator_id=request.coordinator_id, due_date=request.due_date, unit_asset_ids=request.unit_asset_ids), db, user)
        request.status = 'APPROVED'
        request.event_issue_id = event.id
        request.decided_by_id = user.id
        request.decided_at = datetime.now(timezone.utc)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail='Equipment availability changed; review the request again')
    return request


@router.post('/requests/{request_id}/reject', response_model=EventRequestResponse)
async def reject(request_id: int, payload: Rejection, db: AsyncSession = Depends(get_db),
                 user: User = Depends(require_role(RoleEnum.ASSISTANT))):
    if not payload.reason.strip():
        raise HTTPException(status_code=400, detail='A rejection reason is required')
    request = await pending_request(db, request_id, user)
    request.status = 'REJECTED'
    request.rejection_reason = payload.reason.strip()
    request.decided_by_id = user.id
    request.decided_at = datetime.now(timezone.utc)
    await create_notification(db, request.coordinator_id, 'Event Request Rejected',
        f'{request.event_name}: {request.rejection_reason}', NotificationTypeEnum.WARNING, NotificationCategoryEnum.REQUEST)
    await db.commit()
    return request
