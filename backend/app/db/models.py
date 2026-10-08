"""Canonical LabTrack schema (Alembic revision c7d2e4f1a9b0 and later).

The database is the source of truth: every rule below that can be expressed as a
constraint is also created by the Alembic migration. Never use Base.metadata.create_all()
against a real database; always run `alembic upgrade head`.
"""
from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, Boolean, Enum, Text,
    CheckConstraint, Index, UniqueConstraint, PrimaryKeyConstraint, JSON, text, func,
)
import enum
from datetime import datetime, timezone

from app.db.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- enums
class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    ASSISTANT = "ASSISTANT"
    FACULTY = "FACULTY"
    STUDENT = "STUDENT"

class AccountStatusEnum(str, enum.Enum):
    PENDING = "PENDING"          # self-registered faculty/assistant awaiting admin approval
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"        # registration rejected by an admin
    DEACTIVATED = "DEACTIVATED"  # soft-deleted; history is retained

class UnitStatusEnum(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ISSUED = "ISSUED"
    MAINTENANCE = "MAINTENANCE"
    IN_TRANSIT = "IN_TRANSIT"    # reserved by an approved inter-lab transfer

class RequestStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    ISSUED = "ISSUED"
    RETURNED = "RETURNED"

class RequestKindEnum(str, enum.Enum):
    STANDARD = "STANDARD"        # reservation -> approval -> counter checkout
    WALK_IN = "WALK_IN"          # issued directly at the counter
    QUICK_BORROW = "QUICK_BORROW"
    EVENT = "EVENT"              # part of a club/event batch issue

class TransactionStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"            # overdue is derived: ACTIVE and due_date < now
    RETURNED = "RETURNED"

class ExtensionStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class EquipmentTypeEnum(str, enum.Enum):
    STANDARD = "STANDARD"          # Full request → approve → scan → issue flow
    QUICK_BORROW = "QUICK_BORROW"  # Short counter loans to faculty

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

class TransferStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"     # units reserved (IN_TRANSIT)
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"   # units now belong to to_lab
    CANCELLED = "CANCELLED"


def _enum(e, name):
    return Enum(e, name=name)


# ---------------------------------------------------------------- tables
class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    hod_name = Column(String, nullable=True)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)  # stored lower-case
    university_id = Column(String(32), unique=True, nullable=True)   # stored upper-case
    assistant_number = Column(Integer, nullable=True, unique=True)
    hashed_password = Column(String, nullable=True)                  # NULL until activation
    name = Column(String, nullable=False)
    role = Column(_enum(RoleEnum, "roleenum"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    account_status = Column(_enum(AccountStatusEnum, "accountstatusenum"), nullable=False,
                            server_default=AccountStatusEnum.ACTIVE.value)
    # TRUE only for legacy rows that pre-date the domain rules (set by migration, never by the API)
    email_domain_exempt = Column(Boolean, nullable=False, server_default=text("false"))
    activation_token_hash = Column(String(64), nullable=True, unique=True)
    activation_expires_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    status_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    deactivated_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint('assistant_number IS NULL OR assistant_number BETWEEN 1 AND 999', name='ck_users_assistant_number'),
        CheckConstraint(
            "email_domain_exempt OR role = 'ADMIN' "
            "OR (role = 'STUDENT' AND email LIKE '%_@charusat.edu.in') "
            "OR (role IN ('FACULTY', 'ASSISTANT') AND email LIKE '%_@charusat.ac.in')",
            name="ck_users_role_email_domain",
        ),
        CheckConstraint("email = lower(email)", name="ck_users_email_lowercase"),
        CheckConstraint("university_id IS NULL OR university_id = upper(university_id)",
                        name="ck_users_university_id_uppercase"),
        CheckConstraint("account_status <> 'ACTIVE' OR role <> 'ADMIN' OR hashed_password IS NOT NULL "
                        "OR activation_token_hash IS NOT NULL", name="ck_users_admin_credentials"),
    )


class Lab(Base):
    __tablename__ = "labs"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String(16), nullable=False, unique=True)  # used in asset IDs, e.g. IOT
    location = Column(String, nullable=True)

    __table_args__ = (
        CheckConstraint("code ~ '^[A-Z0-9]{2,16}$'", name="ck_labs_code_format"),
    )


class LabAssistantAssignment(Base):
    """Single source of truth for which assistant manages which lab (one assistant per lab)."""
    __tablename__ = "lab_assistant_assignments"
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="CASCADE"), primary_key=True)
    assistant_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class EquipmentModel(Base):
    __tablename__ = "equipment_models"
    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    equipment_type = Column(_enum(EquipmentTypeEnum, "equipmenttypeenum"), nullable=False,
                            server_default=EquipmentTypeEnum.STANDARD.value)


class AssetSequence(Base):
    """Atomic per-prefix counters for asset IDs (LT-<LAB>-<CAT>-<SEQ>)."""
    __tablename__ = "asset_sequences"
    prefix = Column(String(64), primary_key=True)
    last_value = Column(Integer, nullable=False)
    __table_args__ = (CheckConstraint("last_value >= 0", name="ck_asset_sequences_nonneg"),)


class InventoryImportBatch(Base):
    """A successful spreadsheet batch can only add stock once to a lab."""
    __tablename__ = "inventory_import_batches"
    id = Column(Integer, primary_key=True)
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="CASCADE"), nullable=False)
    content_hash = Column(String(64), nullable=False)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    __table_args__ = (UniqueConstraint("lab_id", "content_hash", name="uq_inventory_import_batch"),)


class EquipmentUnit(Base):
    __tablename__ = "equipment_units"
    asset_id = Column(String, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("equipment_models.id", ondelete="RESTRICT"), nullable=False, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False)  # current owning lab
    serial_number = Column(String, nullable=True)
    status = Column(_enum(UnitStatusEnum, "unitstatusenum"), nullable=False,
                    server_default=UnitStatusEnum.AVAILABLE.value)
    condition = Column(String, nullable=True)
    qr_code_url = Column(String, nullable=True)

    __table_args__ = (Index("ix_equipment_units_lab_status", "lab_id", "status"),)


class EventIssue(Base):
    __tablename__ = "event_issues"
    id = Column(Integer, primary_key=True)
    event_name = Column(String(200), nullable=False)
    purpose = Column(Text, nullable=False)
    coordinator_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False)
    issued_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    issue_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    __table_args__ = (CheckConstraint("due_date > issue_date", name="ck_event_issues_dates"),)


class EventRequest(Base):
    __tablename__ = 'event_requests'
    id = Column(Integer, primary_key=True)
    event_name = Column(String(200), nullable=False)
    purpose = Column(Text, nullable=False)
    coordinator_id = Column(Integer, ForeignKey('users.id', ondelete='RESTRICT'), nullable=False)
    lab_id = Column(Integer, ForeignKey('labs.id', ondelete='RESTRICT'), nullable=False)
    unit_asset_ids = Column(JSON, nullable=False)
    requested_items = Column(JSON, nullable=False, server_default=text("'[]'"))
    due_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(16), nullable=False, server_default='PENDING')
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decided_by_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    event_issue_id = Column(Integer, ForeignKey('event_issues.id', ondelete='RESTRICT'), nullable=True, unique=True)
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'APPROVED', 'REJECTED')", name='ck_event_requests_status'),
        CheckConstraint("(status = 'APPROVED') = (event_issue_id IS NOT NULL)", name='ck_event_requests_issue'),
        CheckConstraint("status <> 'REJECTED' OR rejection_reason IS NOT NULL", name='ck_event_requests_rejection'),
        Index('ix_event_requests_lab_status', 'lab_id', 'status'),
    )


class Request(Base):
    __tablename__ = "requests"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    model_id = Column(Integer, ForeignKey("equipment_models.id", ondelete="RESTRICT"), nullable=False)
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False)
    kind = Column(_enum(RequestKindEnum, "requestkindenum"), nullable=False,
                  server_default=RequestKindEnum.STANDARD.value)
    quantity = Column(Integer, nullable=False, server_default=text("1"))
    purpose = Column(Text, nullable=True)
    required_from = Column(DateTime(timezone=True), nullable=False)
    required_until = Column(DateTime(timezone=True), nullable=False)
    status = Column(_enum(RequestStatusEnum, "requeststatusenum"), nullable=False,
                    server_default=RequestStatusEnum.PENDING.value)
    rejection_reason = Column(Text, nullable=True)
    decided_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    event_issue_id = Column(Integer, ForeignKey("event_issues.id", ondelete="RESTRICT"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_requests_quantity_positive"),
        CheckConstraint("required_until > required_from", name="ck_requests_dates"),
        CheckConstraint("status <> 'REJECTED' OR rejection_reason IS NOT NULL", name="ck_requests_rejection_reason"),
        CheckConstraint("(kind = 'EVENT') = (event_issue_id IS NOT NULL)", name="ck_requests_event_link"),
        Index("ix_requests_requester_status", "requester_id", "status"),
        Index("ix_requests_lab_status", "lab_id", "status"),
    )


class ExtensionRequest(Base):
    __tablename__ = "extension_requests"
    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("requests.id", ondelete="RESTRICT"), nullable=False, index=True)
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    current_due_date = Column(DateTime(timezone=True), nullable=False)    # due date when submitted
    requested_due_date = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(_enum(ExtensionStatusEnum, "extensionstatusenum"), nullable=False,
                    server_default=ExtensionStatusEnum.PENDING.value)
    decided_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decision_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("requested_due_date > current_due_date", name="ck_extension_requests_dates"),
        Index("uq_extension_requests_one_pending", "request_id", unique=True,
              postgresql_where=text("status = 'PENDING'")),
    )


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id", ondelete="RESTRICT"), nullable=False, index=True)
    unit_asset_id = Column(String, ForeignKey("equipment_units.asset_id", ondelete="RESTRICT"), nullable=False)
    borrower_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False)
    issue_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=False)
    return_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(_enum(TransactionStatusEnum, "transactionstatusenum"), nullable=False,
                    server_default=TransactionStatusEnum.ACTIVE.value)
    reissued_count = Column(Integer, nullable=False, server_default=text("0"))
    is_quick_borrow = Column(Boolean, nullable=False, server_default=text("false"))
    issued_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    received_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    return_condition = Column(String, nullable=True)
    return_remarks = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("due_date > issue_date", name="ck_transactions_due_after_issue"),
        CheckConstraint("(status = 'RETURNED') = (return_date IS NOT NULL)", name="ck_transactions_return_state"),
        CheckConstraint("return_date IS NULL OR return_date >= issue_date", name="ck_transactions_return_after_issue"),
        CheckConstraint("reissued_count >= 0", name="ck_transactions_reissued_nonneg"),
        # A physical unit can be on at most one open loan.
        Index("uq_transactions_one_active_per_unit", "unit_asset_id", unique=True,
              postgresql_where=text("status = 'ACTIVE'")),
        Index("ix_transactions_lab_status", "lab_id", "status"),
    )


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    type = Column(_enum(NotificationTypeEnum, "notificationtypeenum"), nullable=False,
                  server_default=NotificationTypeEnum.INFO.value)
    category = Column(_enum(NotificationCategoryEnum, "notificationcategoryenum"), nullable=False,
                      server_default=NotificationCategoryEnum.SYSTEM.value)
    read = Column(Boolean, nullable=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (Index("ix_notifications_user_read", "user_id", "read"),)


class SystemSetting(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)


class NotificationEmail(Base):
    """Persistent email outbox, committed with its portal notification."""
    __tablename__ = "notification_emails"
    notification_id = Column(Integer, ForeignKey("notifications.id", ondelete="CASCADE"), primary_key=True)
    attempts = Column(Integer, nullable=False, server_default=text("0"))
    next_attempt_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    failed = Column(Boolean, nullable=False, server_default=text("false"))


class Transfer(Base):
    """Inter-lab transfer of individual physical units (see TransferUnit)."""
    __tablename__ = "transfers"
    id = Column(Integer, primary_key=True, index=True)
    from_lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False)
    to_lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status = Column(_enum(TransferStatusEnum, "transferstatusenum"), nullable=False,
                    server_default=TransferStatusEnum.PENDING.value)
    reason = Column(Text, nullable=True)
    decision_reason = Column(Text, nullable=True)
    decided_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (CheckConstraint("from_lab_id <> to_lab_id", name="ck_transfers_distinct_labs"),)


class TransferUnit(Base):
    __tablename__ = "transfer_units"
    transfer_id = Column(Integer, ForeignKey("transfers.id", ondelete="CASCADE"), nullable=False)
    unit_asset_id = Column(String, ForeignKey("equipment_units.asset_id", ondelete="RESTRICT"), nullable=False,
                           index=True)
    __table_args__ = (PrimaryKeyConstraint("transfer_id", "unit_asset_id"),)

class LegacyColumnValue(Base):
    __tablename__ = "legacy_column_values"
    id = Column(Integer, primary_key=True)
    table_name = Column(String, nullable=False)
    row_key = Column(String, nullable=False)
    column_name = Column(String, nullable=False)
    value = Column(Text, nullable=True)
    migrated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
