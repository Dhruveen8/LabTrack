from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Boolean, Enum, JSON, Text, CheckConstraint
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone

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
    OVERDUE = "OVERDUE"

# --- Phase 5: Equipment type classification ---
class EquipmentTypeEnum(str, enum.Enum):
    STANDARD = "STANDARD"          # Full request → approve → scan → issue flow
    QUICK_BORROW = "QUICK_BORROW"  # Same-day, auto-approve, simplified flow

# --- Phase 6: Notification types ---
class NotificationTypeEnum(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"

class NotificationCategoryEnum(str, enum.Enum):
    REQUEST = "REQUEST"
    CHECKOUT = "CHECKOUT"
    RETURN = "RETURN"
    EXTENSION = "EXTENSION"
    SYSTEM = "SYSTEM"
    QUICK_BORROW = "QUICK_BORROW"

# --- Phase 6: Transfer status ---
class TransferStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    # --- Phase 7.3: Cascade/Restrict foreign keys ---
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    assigned_labs = Column(JSON, nullable=True) # list of lab IDs

    __table_args__ = (
        CheckConstraint(
            "(role != 'STUDENT' AND role != 'FACULTY') OR "
            "(role = 'STUDENT' AND email ~* '^[0-9]{2}[a-z]{2,3}[0-9]{3}@charusat\.edu\.in$') OR "
            "(role = 'FACULTY' AND email ~* '^f[a-z]{2,3}[0-9]{3}@charusat\.edu\.in$')",
            name='user_email_format_check'
        ),
    )

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    hod_name = Column(String, nullable=True)

class Lab(Base):
    __tablename__ = "labs"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"))
    name = Column(String, nullable=False)
    # --- Phase 7.2: Lab code for asset IDs ---
    code = Column(String, nullable=True)  # e.g. IOT, VLSI, ECE
    location = Column(String, nullable=True)
    incharge_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

class EquipmentModel(Base):
    __tablename__ = "equipment_models"
    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"))
    name = Column(String, nullable=False)
    category = Column(String, nullable=False) # e.g. MC for Microcontroller
    total_quantity = Column(Integer, default=0)
    description = Column(String, nullable=True)
    # --- Phase 5: Equipment type ---
    equipment_type = Column(Enum(EquipmentTypeEnum), default=EquipmentTypeEnum.STANDARD)

class EquipmentUnit(Base):
    __tablename__ = "equipment_units"
    asset_id = Column(String, primary_key=True, index=True) # e.g. LT-IOT-MC-00001
    model_id = Column(Integer, ForeignKey("equipment_models.id", ondelete="CASCADE"))
    serial_number = Column(String, nullable=True)
    status = Column(Enum(UnitStatusEnum), default=UnitStatusEnum.AVAILABLE)
    condition = Column(String, nullable=True)
    qr_code_url = Column(String, nullable=True)

class Request(Base):
    __tablename__ = "requests"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    model_id = Column(Integer, ForeignKey("equipment_models.id", ondelete="RESTRICT")) # Changed from equipment_id for clarity
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"))
    required_from = Column(DateTime, nullable=False)
    required_until = Column(DateTime, nullable=False)
    status = Column(Enum(RequestStatusEnum), default=RequestStatusEnum.PENDING)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id", ondelete="RESTRICT"), nullable=True)
    unit_asset_id = Column(String, ForeignKey("equipment_units.asset_id", ondelete="RESTRICT"))
    borrower_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"))
    issue_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    due_date = Column(DateTime, nullable=False)
    return_date = Column(DateTime, nullable=True)
    status = Column(Enum(TransactionStatusEnum), default=TransactionStatusEnum.ACTIVE)
    reissued_count = Column(Integer, default=0)
    # --- Phase 5: Quick-borrow flag ---
    is_quick_borrow = Column(Boolean, default=False)

# --- Phase 6: Notification model ---
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    type = Column(Enum(NotificationTypeEnum), default=NotificationTypeEnum.INFO)
    category = Column(Enum(NotificationCategoryEnum), default=NotificationCategoryEnum.SYSTEM)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# --- Phase 6: System settings model ---
class SystemSetting(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)

# --- Phase 6: Inter-lab transfer model ---
class Transfer(Base):
    __tablename__ = "transfers"
    id = Column(Integer, primary_key=True, index=True)
    equipment_model_id = Column(Integer, ForeignKey("equipment_models.id", ondelete="RESTRICT"), nullable=False)
    from_lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False)
    to_lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status = Column(Enum(TransferStatusEnum), default=TransferStatusEnum.PENDING)
    quantity = Column(Integer, default=1)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)
