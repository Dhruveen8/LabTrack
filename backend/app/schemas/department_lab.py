from pydantic import BaseModel
from typing import Optional, List

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
    location: Optional[str] = None
    department_id: int

class LabCreate(LabBase):
    pass

class LabResponse(LabBase):
    id: int
    incharge_user_id: Optional[int] = None

    class Config:
        from_attributes = True
