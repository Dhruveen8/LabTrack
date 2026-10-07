from pydantic import BaseModel, Field
from typing import Optional, List
from app.db.models import UnitStatusEnum, EquipmentTypeEnum

# Equipment Model Schemas
class EquipmentModelBase(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    lab_id: int

class EquipmentModelCreate(EquipmentModelBase):
    equipment_type: Optional[EquipmentTypeEnum] = EquipmentTypeEnum.STANDARD

class EquipmentModelResponse(EquipmentModelBase):
    id: int
    total_quantity: int = 0
    available_quantity: int = 0
    equipment_type: Optional[EquipmentTypeEnum] = EquipmentTypeEnum.STANDARD

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
    lab_id: int
    status: UnitStatusEnum
    qr_code_url: Optional[str] = None

    class Config:
        from_attributes = True

# Bulk Import Schema
class BulkImportRow(BaseModel):
    model_name: str
    category: str
    quantity: int = Field(ge=1, le=10000)
    description: Optional[str] = None

# --- New schemas for Phase 2 CRUD ---
class EquipmentModelUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    lab_id: Optional[int] = None
    equipment_type: Optional[EquipmentTypeEnum] = None

class UnitStatusUpdate(BaseModel):
    status: Optional[UnitStatusEnum] = None
    condition: Optional[str] = None

class BulkUnitCreate(BaseModel):
    model_id: int
    quantity: int = Field(ge=1, le=10000)

# --- Schemas for Excel Bulk Import ---
class BulkExcelImportRow(BaseModel):
    name: str
    quantity: int = Field(ge=1, le=10000)
    category: str
    serial_prefix: Optional[str] = None
    condition: Optional[str] = None
    description: Optional[str] = None

class BulkExcelImportRequest(BaseModel):
    items: List[BulkExcelImportRow] = Field(min_length=1, max_length=1000)
    lab_id: Optional[int] = None

