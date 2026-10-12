from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime
from app.db.models import RequestStatusEnum, TransactionStatusEnum, RequestKindEnum

# Request Schemas
class RequestBase(BaseModel):
    model_id: int
    required_from: datetime
    required_until: datetime
    kind: Optional[RequestKindEnum] = RequestKindEnum.STANDARD
    quantity: Optional[int] = Field(default=1, strict=True, ge=1, le=500)
    purpose: Optional[str] = None

class RequestCreate(RequestBase):
    pass


class CartQuantity(BaseModel):
    quantity: int = Field(strict=True, ge=1, le=500)


class CartSelection(CartQuantity):
    model_id: int = Field(strict=True, gt=0)
    lab_id: int = Field(strict=True, gt=0)


class CartSubmit(BaseModel):
    items: list[CartSelection] = Field(min_length=1, max_length=100)
    required_from: datetime
    required_until: datetime
    purpose: str = Field(min_length=1, max_length=2000)
    submission_key: str = Field(pattern=r'^[0-9a-fA-F-]{36}$')

    @model_validator(mode='after')
    def unique_items(self):
        keys = [(item.model_id, item.lab_id) for item in self.items]
        if len(keys) != len(set(keys)):
            raise ValueError('Each equipment type and lab must appear once')
        return self


class RequestItemResponse(BaseModel):
    id: int
    model_id: int
    equipment_name: str
    lab_id: int
    lab_name: str
    quantity: int
    status: RequestStatusEnum
    issued_quantity: int = 0
    returned_quantity: int = 0
    reserved_asset_ids: list[str] = Field(default_factory=list)

class RequestResponse(RequestBase):
    id: int
    requester_id: int
    requester_name: Optional[str] = None
    requester_role: Optional[str] = None
    lab_id: int
    status: RequestStatusEnum
    rejection_reason: Optional[str] = None
    decided_by_id: Optional[int] = None
    decided_at: Optional[datetime] = None
    items: list[RequestItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionResponse(BaseModel):
    id: int
    request_id: int
    request_item_id: Optional[int] = None
    model_id: Optional[int] = None
    equipment_name: Optional[str] = None
    lab_name: Optional[str] = None
    unit_asset_id: str
    borrower_id: int
    borrower_name: Optional[str] = None
    borrower_role: Optional[str] = None
    lab_id: int
    issue_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = None
    status: TransactionStatusEnum
    reissued_count: int
    is_quick_borrow: bool = False
    return_condition: Optional[str] = None
    return_remarks: Optional[str] = None

    class Config:
        from_attributes = True

class CheckoutRequest(BaseModel):
    request_id: int
    asset_id: str

class ReturnRequest(BaseModel):
    asset_id: str
    condition_remarks: Optional[str] = None

# --- BE-2: Extension request schema ---
class ExtensionRequest(BaseModel):
    new_due_date: datetime
    reason: Optional[str] = None

# --- Phase 5: Quick-borrow schema ---
class QuickBorrowRequest(BaseModel):
    asset_id: str
    borrower_id: int

class WalkInIssueRequest(BaseModel):
    asset_id: str
    borrower_id: int
    due_date: datetime

class EventIssueCreate(BaseModel):
    event_name: str
    purpose: str
    coordinator_id: int
    due_date: datetime
    unit_asset_ids: list[str]

class EventIssueResponse(BaseModel):
    id: int
    event_name: str
    purpose: str
    coordinator_id: int
    lab_id: int
    issued_by_id: int
    issue_date: datetime
    due_date: datetime

    class Config:
        from_attributes = True
