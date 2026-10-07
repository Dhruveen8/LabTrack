from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db.models import RequestStatusEnum, TransactionStatusEnum, RequestKindEnum

# Request Schemas
class RequestBase(BaseModel):
    model_id: int
    required_from: datetime
    required_until: datetime
    kind: Optional[RequestKindEnum] = RequestKindEnum.STANDARD
    quantity: Optional[int] = 1
    purpose: Optional[str] = None

class RequestCreate(RequestBase):
    pass

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

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionResponse(BaseModel):
    id: int
    request_id: int
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
