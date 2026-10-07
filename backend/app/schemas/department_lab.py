from pydantic import BaseModel, computed_field, field_validator
import re
from typing import Optional

class DepartmentBase(BaseModel):
    name: str
    code: str
    hod_name: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int

    class Config:
        from_attributes = True

class LabBase(BaseModel):
    name: str
    code: str
    location: Optional[str] = None
    department_id: int

class LabCreate(LabBase):
    @field_validator('code')
    @classmethod
    def validate_code(cls, value):
        value = value.strip().upper()
        if not re.fullmatch(r'[A-Z0-9]{2,16}', value):
            raise ValueError('Lab code must contain 2–16 letters or digits, for example IOT')
        return value

class LabResponse(LabBase):
    id: int

    @computed_field
    @property
    def display_id(self) -> str:
        return f"LAB-{self.code}"


    class Config:
        from_attributes = True
