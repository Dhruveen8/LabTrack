from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Boolean, Enum, JSON
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

from app.db.database import Base

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    ASSISTANT = "ASSISTANT"
    FACULTY = "FACULTY"
    STUDENT = "STUDENT"

class UnitStatusEnum(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ISSUED = "ISSUED"
    MAINTENANCE = "MAINTENANCE"

class RequestStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    ISSUED = "ISSUED"
    RETURNED = "RETURNED"
    REJECTED = "REJECTED"
    EXTENSION_PENDING = "EXTENSION_PENDING"
    EXTENDED = "EXTENDED"

class TransactionStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RETURNED = "RETURNED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    assigned_labs = Column(JSON, nullable=True) # list of lab IDs

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    hod_name = Column(String, nullable=True)

class Lab(Base):
    __tablename__ = "labs"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    incharge_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class EquipmentModel(Base):
    __tablename__ = "equipment_models"
    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"))
    name = Column(String, nullable=False)
    category = Column(String, nullable=False) # e.g. MC for Microcontroller
    total_quantity = Column(Integer, default=0)
    description = Column(String, nullable=True)

class EquipmentUnit(Base):
    __tablename__ = "equipment_units"
    asset_id = Column(String, primary_key=True, index=True) # e.g. LT-IOT-MC-00001
    model_id = Column(Integer, ForeignKey("equipment_models.id"))
    serial_number = Column(String, nullable=True)
    status = Column(Enum(UnitStatusEnum), default=UnitStatusEnum.AVAILABLE)
    condition = Column(String, nullable=True)
    qr_code_url = Column(String, nullable=True)

class Request(Base):
    __tablename__ = "requests"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"))
    model_id = Column(Integer, ForeignKey("equipment_models.id")) # Changed from equipment_id for clarity
    lab_id = Column(Integer, ForeignKey("labs.id"))
    required_from = Column(DateTime, nullable=False)
    required_until = Column(DateTime, nullable=False)
    status = Column(Enum(RequestStatusEnum), default=RequestStatusEnum.PENDING)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id"))
    unit_asset_id = Column(String, ForeignKey("equipment_units.asset_id"))
    borrower_id = Column(Integer, ForeignKey("users.id"))
    lab_id = Column(Integer, ForeignKey("labs.id"))
    issue_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=False)
    return_date = Column(DateTime, nullable=True)
    status = Column(Enum(TransactionStatusEnum), default=TransactionStatusEnum.ACTIVE)
    reissued_count = Column(Integer, default=0)
