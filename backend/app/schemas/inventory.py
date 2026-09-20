from pydantic import BaseModel
from typing import Optional, List
from app.db.models import UnitStatusEnum

# Equipment Model Schemas
class EquipmentModelBase(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    lab_id: int

class EquipmentModelCreate(EquipmentModelBase):
    pass

class EquipmentModelResponse(EquipmentModelBase):
    id: int
    total_quantity: int

    class Config:
        from_attributes = True

# Equipment Unit Schemas
class EquipmentUnitBase(BaseModel):
    serial_number: Optional[str] = None
    condition: Optional[str] = None

class EquipmentUnitCreate(EquipmentUnitBase):
    model_id: int

class EquipmentUnitResponse(EquipmentUnitBase):
    asset_id: str
    model_id: int
    status: UnitStatusEnum
    qr_code_url: Optional[str] = None

    class Config:
        from_attributes = True

# Bulk Import Schema
class BulkImportRow(BaseModel):
    model_name: str
    category: str
    quantity: int
    description: Optional[str] = None
