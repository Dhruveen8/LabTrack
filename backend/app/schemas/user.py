from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.db.models import RoleEnum

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: RoleEnum
    department_id: Optional[int] = None
    assigned_labs: Optional[List[int]] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[RoleEnum] = None
    department_id: Optional[int] = None
    assigned_labs: Optional[List[int]] = None

class UserInDBBase(UserBase):
    id: int

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass
