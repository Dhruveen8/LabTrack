from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional, List
import re
from app.db.models import RoleEnum

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: RoleEnum
    department_id: Optional[int] = None
    assigned_labs: Optional[List[int]] = None

class UserCreate(UserBase):
    password: str

    @model_validator(mode='after')
    def validate_email_format(self):
        if self.role == RoleEnum.STUDENT:
            if not re.match(r"^\d{2}[a-zA-Z]{2,3}\d{3}@charusat\.edu\.in$", self.email):
                raise ValueError("Student email must be in the format <2 digit year><department><3-digit>@charusat.edu.in (e.g., 24CE001@charusat.edu.in)")
        elif self.role == RoleEnum.FACULTY:
            if not re.match(r"^F[a-zA-Z]{2,3}\d{3}@charusat\.edu\.in$", self.email, re.IGNORECASE):
                raise ValueError("Faculty email must be in the format F<department><3-digit>@charusat.edu.in (e.g., FCE001@charusat.edu.in)")
        return self

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[RoleEnum] = None
    department_id: Optional[int] = None
    assigned_labs: Optional[List[int]] = None

    @model_validator(mode='after')
    def validate_email_format(self):
        if self.email and self.role:
            if self.role == RoleEnum.STUDENT and not re.match(r"^\d{2}[a-zA-Z]{2,3}\d{3}@charusat\.edu\.in$", self.email):
                raise ValueError("Student email must be in the format <2 digit year><department><3-digit>@charusat.edu.in (e.g., 24CE001@charusat.edu.in)")
            elif self.role == RoleEnum.FACULTY and not re.match(r"^F[a-zA-Z]{2,3}\d{3}@charusat\.edu\.in$", self.email, re.IGNORECASE):
                raise ValueError("Faculty email must be in the format F<department><3-digit>@charusat.edu.in (e.g., FCE001@charusat.edu.in)")
        return self

class UserInDBBase(UserBase):
    id: int

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass
