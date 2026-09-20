from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db.models import RequestStatusEnum, TransactionStatusEnum

# Request Schemas
class RequestBase(BaseModel):
    model_id: int
    required_from: datetime
    required_until: datetime

class RequestCreate(RequestBase):
    pass

class RequestResponse(RequestBase):
    id: int
    requester_id: int
    lab_id: int
    status: RequestStatusEnum

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionResponse(BaseModel):
    id: int
    request_id: int
    unit_asset_id: str
    borrower_id: int
    lab_id: int
    issue_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = None
    status: TransactionStatusEnum
    reissued_count: int

    class Config:
        from_attributes = True

class CheckoutRequest(BaseModel):
    request_id: int
    asset_id: str

class ReturnRequest(BaseModel):
    asset_id: str
    condition_remarks: Optional[str] = None
