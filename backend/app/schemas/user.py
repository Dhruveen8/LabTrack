from pydantic import BaseModel, EmailStr, model_validator, computed_field, field_validator, Field
from typing import Optional
from app.db.models import RoleEnum, AccountStatusEnum
from app.services.user_ids import institutional_id

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: RoleEnum
    department_id: Optional[int] = None

class UserCreate(UserBase):
    password: str
    university_id: Optional[str] = None

    @field_validator('university_id')
    @classmethod
    def normalize_university_id(cls, value):
        if value is None or not value.strip():
            return None
        value = value.strip().upper()
        if len(value) > 32 or not all(character.isalnum() or character in '-_.' for character in value):
            raise ValueError('Institutional ID must contain at most 32 letters, numbers, hyphens, dots or underscores')
        return value

    @model_validator(mode='after')
    def validate_email_format(self):
        email_lower = self.email.lower()
        if self.role in (RoleEnum.STUDENT, RoleEnum.FACULTY):
            self.university_id = institutional_id(self.role, self.university_id or email_lower.split('@')[0])
        elif self.role == RoleEnum.ASSISTANT:
            if self.university_id:
                raise ValueError('Assistant IDs are generated automatically')
        if self.role == RoleEnum.STUDENT:
            if not email_lower.endswith("@charusat.edu.in"):
                raise ValueError("Student email must end with @charusat.edu.in")
        elif self.role in (RoleEnum.FACULTY, RoleEnum.ASSISTANT):
            if not email_lower.endswith("@charusat.ac.in"):
                raise ValueError(f"{self.role.value.capitalize()} email must end with @charusat.ac.in")
        return self

class UserRegistration(UserCreate):
    department_id: int = Field(gt=0)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[RoleEnum] = None
    department_id: Optional[int] = None
    account_status: Optional[AccountStatusEnum] = None
    university_id: Optional[str] = None

    @model_validator(mode='after')
    def validate_email_format(self):
        if self.email and self.role:
            email_lower = self.email.lower()
            if self.role == RoleEnum.STUDENT and not email_lower.endswith("@charusat.edu.in"):
                raise ValueError("Student email must end with @charusat.edu.in")
            elif self.role in (RoleEnum.FACULTY, RoleEnum.ASSISTANT) and not email_lower.endswith("@charusat.ac.in"):
                raise ValueError(f"{self.role.value.capitalize()} email must end with @charusat.ac.in")
        return self

class UserInDBBase(UserBase):
    id: int
    account_status: AccountStatusEnum
    university_id: Optional[str] = None
    assistant_number: Optional[int] = Field(default=None, exclude=True)
    assigned_lab_ids: Optional[list] = []

    class Config:
        from_attributes = True

class User(UserInDBBase):
    @computed_field
    @property
    def display_id(self) -> str:
        if self.role == RoleEnum.ASSISTANT:
            return f"ASST{self.assistant_number or self.id:03d}"
        return self.university_id or str(self.id)
