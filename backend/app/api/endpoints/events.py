"""Faculty event requests; only the assigned assistant can approve and issue."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.api.endpoints.borrowing import issue_approved_event
from app.api.endpoints.notifications import create_notification
from app.db.database import get_db
from app.db.models import (EventRequest, EquipmentModel, EquipmentUnit, LabAssistantAssignment, User, RoleEnum,
                          UnitStatusEnum, NotificationTypeEnum, NotificationCategoryEnum)
from app.schemas.borrowing import EventIssueCreate
from app.services.lab_access import get_assistant_labs

router = APIRouter()


class RequestedItem(BaseModel):
    model_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=1000, strict=True)


class Allocation(BaseModel):
    unit_asset_ids: list[str] = Field(min_length=1, max_length=1000)

    @field_validator('unit_asset_ids')
    @classmethod
    def valid_assets(cls, values):
        values = [value.strip() for value in values]
        if any(not value for value in values) or len(set(values)) != len(values):
            raise ValueError('Asset IDs must be nonempty and unique')
        return values


class EventRequestCreate(BaseModel):
    event_name: str = Field(min_length=1, max_length=200)
    purpose: str = Field(min_length=1)
    due_date: datetime
    unit_asset_ids: list[str] = Field(default_factory=list, max_length=1000)
    lab_id: Optional[int] = Field(default=None, gt=0)
    requested_items: list[RequestedItem] = Field(default_factory=list, max_length=1000)
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

    @model_validator(mode='after')
    def valid_request(self):
        if self.requested_items:
            if self.lab_id is None or self.unit_asset_ids:
                raise ValueError('Select a lab and request equipment types without asset IDs')
            ids = [item.model_id for item in self.requested_items]
            if len(set(ids)) != len(ids) or sum(item.quantity for item in self.requested_items) > 1000:
                raise ValueError('Equipment types must be unique; request at most 1000 units')
        elif not self.unit_asset_ids:
            raise ValueError('Select at least one equipment type')
        return self


class EventRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_name: str
    purpose: str
    coordinator_id: int
    coordinator_name: Optional[str] = None
    lab_id: int
    unit_asset_ids: list[str]
    requested_items: list[RequestedItem] = Field(default_factory=list)
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
    if payload.requested_items:
        lab_id = payload.lab_id
        for item in payload.requested_items:
            model = await db.get(EquipmentModel, item.model_id)
            if not model or model.lab_id != lab_id:
                raise HTTPException(status_code=400, detail='Selected equipment must belong to the selected lab')
            available = (await db.execute(select(func.count()).select_from(EquipmentUnit).where(
                EquipmentUnit.model_id == item.model_id, EquipmentUnit.lab_id == lab_id,
                EquipmentUnit.status == UnitStatusEnum.AVAILABLE))).scalar_one()
            if available < item.quantity:
                raise HTTPException(status_code=400, detail=f'Only {available} units of {model.name} are available')
        quantity = sum(item.quantity for item in payload.requested_items)
    else:
        units = (await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id.in_(payload.unit_asset_ids)))).scalars().all()
        if len(units) != len(payload.unit_asset_ids):
            raise HTTPException(status_code=404, detail='One or more equipment units not found')
        lab_id = units[0].lab_id
        if any(unit.lab_id != lab_id for unit in units):
            raise HTTPException(status_code=400, detail='All equipment must belong to the same lab')
        if any(unit.status != UnitStatusEnum.AVAILABLE for unit in units):
            raise HTTPException(status_code=400, detail='One or more equipment units are unavailable')
        quantity = len(units)
    assistant_id = (await db.execute(select(LabAssistantAssignment.assistant_id)
                                   .where(LabAssistantAssignment.lab_id == lab_id))).scalar_one_or_none()
    assistant = await db.get(User, assistant_id) if assistant_id else None
    if not assistant or assistant.account_status.value != 'ACTIVE':
        raise HTTPException(status_code=400, detail='This lab needs an active assigned assistant before you can submit a request')
    request = EventRequest(event_name=payload.event_name, purpose=payload.purpose,
                           coordinator_id=user.id, lab_id=lab_id, unit_asset_ids=payload.unit_asset_ids,
                           requested_items=[item.model_dump() for item in payload.requested_items], due_date=due)
    db.add(request)
    await db.flush()
    await create_notification(db, assistant_id, 'Event Request Pending',
        f'{user.name} requested {quantity} units for {request.event_name}. Review it in Event / Club Requests.',
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
async def approve(request_id: int, payload: Optional[Allocation] = None, db: AsyncSession = Depends(get_db),
                  user: User = Depends(require_role(RoleEnum.ASSISTANT))):
    request = await pending_request(db, request_id, user)
    assets = payload.unit_asset_ids if payload else request.unit_asset_ids
    if request.requested_items:
        if not assets:
            raise HTTPException(status_code=400, detail='Select the specific equipment units to allocate')
        units = (await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id.in_(assets))
                                 .order_by(EquipmentUnit.asset_id).with_for_update())).scalars().all()
        if len(units) != len(assets):
            raise HTTPException(status_code=400, detail='One or more selected units no longer exist')
        allocated = {}
        for unit in units:
            if unit.lab_id != request.lab_id:
                raise HTTPException(status_code=400, detail='Allocate units from the requested lab')
            allocated[unit.model_id] = allocated.get(unit.model_id, 0) + 1
        expected = {item['model_id']: item['quantity'] for item in request.requested_items}
        if allocated != expected:
            raise HTTPException(status_code=400, detail='Allocated equipment types and quantities must match the request exactly')
    elif payload and set(assets) != set(request.unit_asset_ids):
        raise HTTPException(status_code=400, detail='Selected units must match this existing asset request')
    try:
        event = await issue_approved_event(EventIssueCreate(event_name=request.event_name, purpose=request.purpose,
            coordinator_id=request.coordinator_id, due_date=request.due_date, unit_asset_ids=assets), db, user)
        request.unit_asset_ids = assets
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
