"""Canonical schema: auth/approval, normalized lab assignments, unit-level lab ownership,
request quantity/purpose, extension requests, event issues, unit-based transfers, constraints.

Data-retention policy (see backend/docs/MIGRATION_NOTES.md):
  * No row is deleted from users/labs/models/units/requests/transactions/notifications.
  * Every value that is dropped or normalised is copied into `legacy_column_values` first.
  * Legacy transfers (model+quantity based, not representable per unit) are copied to
    `legacy_transfers_v1` before being removed from `transfers`.
  * If legacy data violates a new invariant in a way that cannot be fixed without guessing,
    the migration ABORTS with an explanatory error and changes nothing (single transaction).

Revision ID: c7d2e4f1a9b0
Revises: 3bbc99b4bf66
Create Date: 2026-10-06 02:30:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c7d2e4f1a9b0"
down_revision: Union[str, Sequence[str], None] = "3bbc99b4bf66"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _abort_if(sql: str, message: str) -> None:
    """Abort the (transactional) migration if `sql` returns a non-zero count."""
    bind = op.get_bind()
    count = bind.execute(sa.text(sql)).scalar() or 0
    if count:
        raise RuntimeError(
            f"Migration c7d2e4f1a9b0 aborted, no changes applied: {message} ({count} row(s)). "
            "Fix or export these rows manually, then re-run `alembic upgrade head`."
        )


def _legacy(table: str, key_sql: str, column: str, value_sql: str, where: str = "TRUE") -> None:
    op.execute(
        f"INSERT INTO legacy_column_values (table_name, row_key, column_name, value) "
        f"SELECT '{table}', ({key_sql})::text, '{column}', ({value_sql})::text FROM {table} WHERE {where}"
    )


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------ preconditions (abort, never discard)
    _abort_if("SELECT count(*) FROM (SELECT lower(email) FROM users GROUP BY 1 HAVING count(*) > 1) d",
              "users whose e-mails collide case-insensitively")
    _abort_if("SELECT count(*) FROM labs WHERE department_id IS NULL", "labs without a department")
    _abort_if("SELECT count(*) FROM equipment_models WHERE lab_id IS NULL", "equipment models without a lab")
    _abort_if("SELECT count(*) FROM equipment_units WHERE model_id IS NULL", "equipment units without a model")
    _abort_if("SELECT count(*) FROM requests WHERE requester_id IS NULL OR model_id IS NULL OR lab_id IS NULL",
              "requests missing requester/model/lab")
    _abort_if("SELECT count(*) FROM requests WHERE required_until <= required_from",
              "requests whose end date is not after the start date")
    _abort_if("SELECT count(*) FROM transactions WHERE request_id IS NULL OR unit_asset_id IS NULL "
              "OR borrower_id IS NULL OR lab_id IS NULL OR issue_date IS NULL",
              "transactions missing request/unit/borrower/lab/issue_date")
    _abort_if("SELECT count(*) FROM transactions WHERE (status = 'RETURNED') <> (return_date IS NOT NULL)",
              "transactions whose status and return_date disagree")
    _abort_if("SELECT count(*) FROM transactions WHERE due_date AT TIME ZONE 'UTC' <= issue_date",
              "transactions due on/before their issue date")
    _abort_if("SELECT count(*) FROM (SELECT unit_asset_id FROM transactions WHERE status IN ('ACTIVE','OVERDUE') "
              "GROUP BY 1 HAVING count(*) > 1) d", "units with more than one open transaction")

    # ------------------------------------------------------------ retention table
    op.create_table(
        "legacy_column_values",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("table_name", sa.String(), nullable=False),
        sa.Column("row_key", sa.String(), nullable=False),
        sa.Column("column_name", sa.String(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("migrated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ------------------------------------------------------------ enum types
    account_status = postgresql.ENUM("PENDING", "ACTIVE", "REJECTED", "DEACTIVATED", name="accountstatusenum", create_type=False)
    request_kind = postgresql.ENUM("STANDARD", "WALK_IN", "QUICK_BORROW", "EVENT", name="requestkindenum", create_type=False)
    ext_status = postgresql.ENUM("PENDING", "APPROVED", "REJECTED", name="extensionstatusenum", create_type=False)
    for e in (account_status, request_kind, ext_status):
        e.create(bind, checkfirst=True)
    op.execute("ALTER TYPE unitstatusenum ADD VALUE IF NOT EXISTS 'IN_TRANSIT'")
    op.execute("ALTER TYPE transferstatusenum ADD VALUE IF NOT EXISTS 'CANCELLED'")

    # ------------------------------------------------------------ users
    _legacy("users", "id", "email", "email", "email <> lower(email)")
    op.execute("UPDATE users SET email = lower(email)")
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)
    op.add_column("users", sa.Column("university_id", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("account_status", account_status, nullable=False, server_default="ACTIVE"))
    op.add_column("users", sa.Column("email_domain_exempt", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("activation_token_hash", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("activation_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("approved_by_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("status_reason", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key("fk_users_approved_by_id", "users", "users", ["approved_by_id"], ["id"], ondelete="SET NULL")
    op.create_unique_constraint("users_university_id_key", "users", ["university_id"])
    op.create_unique_constraint("users_activation_token_hash_key", "users", ["activation_token_hash"])
    # Derive institutional IDs from the e-mail local part where it is a plausible, unique ID.
    op.execute("""
        WITH c AS (
            SELECT id, upper(split_part(email, '@', 1)) AS uid FROM users
            WHERE role <> 'ADMIN' AND split_part(email, '@', 1) ~ '^[A-Za-z0-9-]{3,32}$'
        ), u AS (SELECT uid FROM c GROUP BY uid HAVING count(*) = 1)
        UPDATE users SET university_id = c.uid FROM c JOIN u USING (uid) WHERE users.id = c.id
    """)
    # Legacy accounts that pre-date the domain rules are kept working but flagged.
    op.execute("""
        UPDATE users SET email_domain_exempt = TRUE,
               status_reason = 'Legacy account: e-mail does not match the role domain rule; update the e-mail.'
        WHERE NOT (role = 'ADMIN'
              OR (role = 'STUDENT' AND email LIKE '%_@charusat.edu.in')
              OR (role IN ('FACULTY','ASSISTANT') AND email LIKE '%_@charusat.ac.in'))
    """)
    op.create_check_constraint("ck_users_role_email_domain", "users",
        "email_domain_exempt OR role = 'ADMIN' "
        "OR (role = 'STUDENT' AND email LIKE '%_@charusat.edu.in') "
        "OR (role IN ('FACULTY', 'ASSISTANT') AND email LIKE '%_@charusat.ac.in')")
    op.create_check_constraint("ck_users_email_lowercase", "users", "email = lower(email)")
    op.create_check_constraint("ck_users_university_id_uppercase", "users",
                               "university_id IS NULL OR university_id = upper(university_id)")
    op.create_check_constraint("ck_users_admin_credentials", "users",
        "account_status <> 'ACTIVE' OR role <> 'ADMIN' OR hashed_password IS NOT NULL OR activation_token_hash IS NOT NULL")

    # ------------------------------------------------------------ lab assignments (single source of truth)
    op.create_table(
        "lab_assistant_assignments",
        sa.Column("lab_id", sa.Integer(), sa.ForeignKey("labs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("assistant_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_lab_assistant_assignments_assistant_id", "lab_assistant_assignments", ["assistant_id"])
    _legacy("users", "id", "assigned_labs", "assigned_labs", "assigned_labs IS NOT NULL")
    _legacy("labs", "id", "incharge_user_id", "incharge_user_id", "incharge_user_id IS NOT NULL")
    # Rule: labs.incharge_user_id wins if it points at an assistant; otherwise the lowest-id
    # assistant whose JSON assigned_labs lists the lab. Conflicting sources are retained above.
    op.execute("""
        INSERT INTO lab_assistant_assignments (lab_id, assistant_id)
        SELECT l.id, u.id FROM labs l JOIN users u ON u.id = l.incharge_user_id AND u.role = 'ASSISTANT'
    """)
    op.execute("""
        INSERT INTO lab_assistant_assignments (lab_id, assistant_id)
        SELECT lab_id, min(user_id) FROM (
            SELECT u.id AS user_id, (j.v)::int AS lab_id
            FROM users u
            CROSS JOIN LATERAL json_array_elements_text(
                CASE WHEN json_typeof(u.assigned_labs) = 'array' THEN u.assigned_labs ELSE '[]'::json END) AS j(v)
            WHERE u.role = 'ASSISTANT' AND j.v ~ '^[0-9]+$'
        ) s
        WHERE lab_id IN (SELECT id FROM labs)
          AND lab_id NOT IN (SELECT lab_id FROM lab_assistant_assignments)
        GROUP BY lab_id
    """)
    op.drop_column("users", "assigned_labs")
    op.drop_constraint("labs_incharge_user_id_fkey", "labs", type_="foreignkey")
    op.drop_column("labs", "incharge_user_id")

    # ------------------------------------------------------------ labs
    _legacy("labs", "id", "code", "code")
    op.execute("UPDATE labs SET code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'))")
    op.execute("UPDATE labs SET code = 'LAB' || id WHERE length(code) < 2 OR length(code) > 16")
    op.execute("""UPDATE labs l SET code = left(l.code, 12) || l.id
                  WHERE EXISTS (SELECT 1 FROM labs o WHERE o.code = l.code AND o.id < l.id)""")
    op.alter_column("labs", "code", existing_type=sa.String(), type_=sa.String(16), nullable=False)
    op.alter_column("labs", "department_id", existing_type=sa.Integer(), nullable=False)
    op.create_unique_constraint("labs_code_key", "labs", ["code"])
    op.create_check_constraint("ck_labs_code_format", "labs", "code ~ '^[A-Z0-9]{2,16}$'")

    # ------------------------------------------------------------ equipment models
    _legacy("equipment_models", "id", "total_quantity", "total_quantity")
    op.drop_column("equipment_models", "total_quantity")  # now derived from equipment_units
    op.execute("UPDATE equipment_models SET equipment_type = 'STANDARD' WHERE equipment_type IS NULL")
    op.alter_column("equipment_models", "equipment_type", nullable=False, server_default="STANDARD",
                    existing_type=sa.Enum(name="equipmenttypeenum"))
    op.alter_column("equipment_models", "lab_id", existing_type=sa.Integer(), nullable=False)
    op.create_index("ix_equipment_models_lab_id", "equipment_models", ["lab_id"])

    # ------------------------------------------------------------ equipment units
    op.add_column("equipment_units", sa.Column("lab_id", sa.Integer(), nullable=True))
    op.execute("UPDATE equipment_units u SET lab_id = m.lab_id FROM equipment_models m WHERE m.id = u.model_id")
    op.alter_column("equipment_units", "lab_id", nullable=False)
    op.create_foreign_key("equipment_units_lab_id_fkey", "equipment_units", "labs", ["lab_id"], ["id"], ondelete="RESTRICT")
    op.execute("UPDATE equipment_units SET status = 'AVAILABLE' WHERE status IS NULL")
    op.alter_column("equipment_units", "status", nullable=False, server_default="AVAILABLE",
                    existing_type=sa.Enum(name="unitstatusenum"))
    op.alter_column("equipment_units", "model_id", existing_type=sa.Integer(), nullable=False)
    # Units with history must never be cascaded away with their model.
    op.drop_constraint("equipment_units_model_id_fkey", "equipment_units", type_="foreignkey")
    op.create_foreign_key("equipment_units_model_id_fkey", "equipment_units", "equipment_models",
                          ["model_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_equipment_units_model_id", "equipment_units", ["model_id"])
    op.create_index("ix_equipment_units_lab_status", "equipment_units", ["lab_id", "status"])

    op.create_table(
        "asset_sequences",
        sa.Column("prefix", sa.String(64), primary_key=True),
        sa.Column("last_value", sa.Integer(), nullable=False),
        sa.CheckConstraint("last_value >= 0", name="ck_asset_sequences_nonneg"),
    )

    # ------------------------------------------------------------ event issues
    op.create_table(
        "event_issues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_name", sa.String(200), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("coordinator_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("lab_id", sa.Integer(), sa.ForeignKey("labs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("issued_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("issue_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("due_date > issue_date", name="ck_event_issues_dates"),
    )

    # ------------------------------------------------------------ requests
    for col in ("required_from", "required_until"):
        op.execute(f"ALTER TABLE requests ALTER COLUMN {col} TYPE timestamptz USING {col} AT TIME ZONE 'UTC'")
    op.add_column("requests", sa.Column("kind", request_kind, nullable=False, server_default="STANDARD"))
    op.add_column("requests", sa.Column("quantity", sa.Integer(), nullable=False, server_default=sa.text("1")))
    op.add_column("requests", sa.Column("purpose", sa.Text(), nullable=True))
    op.add_column("requests", sa.Column("rejection_reason", sa.Text(), nullable=True))
    op.add_column("requests", sa.Column("decided_by_id", sa.Integer(), nullable=True))
    op.add_column("requests", sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("requests", sa.Column("event_issue_id", sa.Integer(), nullable=True))
    op.add_column("requests", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_foreign_key("fk_requests_decided_by_id", "requests", "users", ["decided_by_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_requests_event_issue_id", "requests", "event_issues", ["event_issue_id"], ["id"], ondelete="RESTRICT")
    op.execute("UPDATE requests r SET kind = 'QUICK_BORROW' FROM transactions t "
               "WHERE t.request_id = r.id AND t.is_quick_borrow IS TRUE")
    op.execute("UPDATE requests SET rejection_reason = 'Not recorded (rejected before reasons were stored)' "
               "WHERE status = 'REJECTED'")

    # Extension requests are now separate rows; the request keeps its agreed dates until approval.
    op.create_table(
        "extension_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("requests.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("requested_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("current_due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", ext_status, nullable=False, server_default="PENDING"),
        sa.Column("decided_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("requested_due_date > current_due_date", name="ck_extension_requests_dates"),
    )
    op.create_index("ix_extension_requests_request_id", "extension_requests", ["request_id"])
    op.create_index("uq_extension_requests_one_pending", "extension_requests", ["request_id"], unique=True,
                    postgresql_where=sa.text("status = 'PENDING'"))
    # Legacy EXTENSION_PENDING overwrote required_until with the *requested* date. Recover it:
    # the real current due date is still on the active transaction.
    _legacy("requests", "id", "status", "status", "status IN ('EXTENSION_PENDING', 'EXTENDED')")
    _legacy("requests", "id", "required_until", "required_until", "status = 'EXTENSION_PENDING'")
    op.execute("""
        INSERT INTO extension_requests (request_id, requested_by_id, current_due_date, requested_due_date, reason)
        SELECT r.id, r.requester_id, t.due_date AT TIME ZONE 'UTC', r.required_until,
               'Migrated from legacy EXTENSION_PENDING status'
        FROM requests r
        JOIN LATERAL (SELECT due_date FROM transactions WHERE request_id = r.id
                      AND status IN ('ACTIVE','OVERDUE') ORDER BY id LIMIT 1) t ON TRUE
        WHERE r.status = 'EXTENSION_PENDING' AND r.required_until > t.due_date AT TIME ZONE 'UTC'
    """)
    op.execute("""
        UPDATE requests r SET required_until = e.current_due_date
        FROM extension_requests e WHERE e.request_id = r.id AND r.status = 'EXTENSION_PENDING'
          AND e.current_due_date > r.required_from
    """)
    op.execute("ALTER TYPE requeststatusenum RENAME TO requeststatusenum_old")
    op.execute("CREATE TYPE requeststatusenum AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED','ISSUED','RETURNED')")
    op.execute("""ALTER TABLE requests ALTER COLUMN status TYPE requeststatusenum USING (
                    CASE status::text WHEN 'EXTENSION_PENDING' THEN 'ISSUED' WHEN 'EXTENDED' THEN 'ISSUED'
                    WHEN NULL THEN 'PENDING' ELSE status::text END)::requeststatusenum""")
    op.execute("DROP TYPE requeststatusenum_old")
    op.execute("UPDATE requests SET status = 'PENDING' WHERE status IS NULL")
    op.alter_column("requests", "status", nullable=False, server_default="PENDING")
    for col in ("requester_id", "model_id", "lab_id"):
        op.alter_column("requests", col, existing_type=sa.Integer(), nullable=False)
    op.create_check_constraint("ck_requests_quantity_positive", "requests", "quantity > 0")
    op.create_check_constraint("ck_requests_dates", "requests", "required_until > required_from")
    op.create_check_constraint("ck_requests_rejection_reason", "requests",
                               "status <> 'REJECTED' OR rejection_reason IS NOT NULL")
    op.create_check_constraint("ck_requests_event_link", "requests", "(kind = 'EVENT') = (event_issue_id IS NOT NULL)")
    op.create_index("ix_requests_requester_status", "requests", ["requester_id", "status"])
    op.create_index("ix_requests_lab_status", "requests", ["lab_id", "status"])

    # ------------------------------------------------------------ transactions
    for col in ("due_date", "return_date"):
        op.execute(f"ALTER TABLE transactions ALTER COLUMN {col} TYPE timestamptz USING {col} AT TIME ZONE 'UTC'")
    _legacy("transactions", "id", "status", "status", "status = 'OVERDUE'")
    op.execute("ALTER TYPE transactionstatusenum RENAME TO transactionstatusenum_old")
    op.execute("CREATE TYPE transactionstatusenum AS ENUM ('ACTIVE','RETURNED')")
    op.execute("""ALTER TABLE transactions ALTER COLUMN status TYPE transactionstatusenum USING (
                    CASE WHEN status IS NULL OR status::text = 'OVERDUE' THEN 'ACTIVE'
                    ELSE status::text END)::transactionstatusenum""")
    op.execute("DROP TYPE transactionstatusenum_old")
    op.execute("UPDATE transactions SET status = CASE WHEN return_date IS NULL THEN 'ACTIVE' ELSE 'RETURNED' END::transactionstatusenum WHERE status IS NULL")
    op.alter_column("transactions", "status", nullable=False, server_default="ACTIVE")
    op.execute("UPDATE transactions SET reissued_count = 0 WHERE reissued_count IS NULL")
    op.execute("UPDATE transactions SET is_quick_borrow = FALSE WHERE is_quick_borrow IS NULL")
    op.alter_column("transactions", "reissued_count", existing_type=sa.Integer(), nullable=False, server_default=sa.text("0"))
    op.alter_column("transactions", "is_quick_borrow", existing_type=sa.Boolean(), nullable=False, server_default=sa.false())
    op.alter_column("transactions", "issue_date", existing_type=sa.DateTime(timezone=True), nullable=False,
                    server_default=sa.func.now())
    for col in ("request_id", "borrower_id", "lab_id"):
        op.alter_column("transactions", col, existing_type=sa.Integer(), nullable=False)
    op.alter_column("transactions", "unit_asset_id", existing_type=sa.String(), nullable=False)
    op.add_column("transactions", sa.Column("issued_by_id", sa.Integer(), nullable=True))
    op.add_column("transactions", sa.Column("received_by_id", sa.Integer(), nullable=True))
    op.add_column("transactions", sa.Column("return_condition", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("return_remarks", sa.Text(), nullable=True))
    op.create_foreign_key("fk_transactions_issued_by_id", "transactions", "users", ["issued_by_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_transactions_received_by_id", "transactions", "users", ["received_by_id"], ["id"], ondelete="SET NULL")
    op.create_check_constraint("ck_transactions_due_after_issue", "transactions", "due_date > issue_date")
    op.create_check_constraint("ck_transactions_return_state", "transactions",
                               "(status = 'RETURNED') = (return_date IS NOT NULL)")
    op.create_check_constraint("ck_transactions_return_after_issue", "transactions",
                               "return_date IS NULL OR return_date >= issue_date")
    op.create_check_constraint("ck_transactions_reissued_nonneg", "transactions", "reissued_count >= 0")
    op.create_index("uq_transactions_one_active_per_unit", "transactions", ["unit_asset_id"], unique=True,
                    postgresql_where=sa.text("status = 'ACTIVE'"))
    op.create_index("ix_transactions_lab_status", "transactions", ["lab_id", "status"])
    op.create_index("ix_transactions_request_id", "transactions", ["request_id"])
    op.create_index("ix_transactions_borrower_id", "transactions", ["borrower_id"])

    # ------------------------------------------------------------ transfers (unit based)
    legacy_transfers = bind.execute(sa.text("SELECT count(*) FROM transfers")).scalar() or 0
    if legacy_transfers:
        op.execute("CREATE TABLE legacy_transfers_v1 AS SELECT * FROM transfers")
        op.execute("DELETE FROM transfers")
    op.drop_constraint("transfers_equipment_model_id_fkey", "transfers", type_="foreignkey")
    op.drop_column("transfers", "equipment_model_id")
    op.drop_column("transfers", "quantity")
    op.add_column("transfers", sa.Column("decision_reason", sa.Text(), nullable=True))
    op.add_column("transfers", sa.Column("decided_by_id", sa.Integer(), nullable=True))
    op.add_column("transfers", sa.Column("completed_by_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_transfers_decided_by_id", "transfers", "users", ["decided_by_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_transfers_completed_by_id", "transfers", "users", ["completed_by_id"], ["id"], ondelete="SET NULL")
    op.alter_column("transfers", "status", nullable=False, server_default="PENDING",
                    existing_type=sa.Enum(name="transferstatusenum"))
    op.alter_column("transfers", "created_at", existing_type=sa.DateTime(timezone=True), nullable=False,
                    server_default=sa.func.now())
    op.create_check_constraint("ck_transfers_distinct_labs", "transfers", "from_lab_id <> to_lab_id")
    op.create_table(
        "transfer_units",
        sa.Column("transfer_id", sa.Integer(), sa.ForeignKey("transfers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unit_asset_id", sa.String(), sa.ForeignKey("equipment_units.asset_id", ondelete="RESTRICT"), nullable=False),
        sa.PrimaryKeyConstraint("transfer_id", "unit_asset_id"),
    )
    op.create_index("ix_transfer_units_unit_asset_id", "transfer_units", ["unit_asset_id"])

    # ------------------------------------------------------------ notifications
    op.execute("UPDATE notifications SET type = coalesce(type, 'INFO'), category = coalesce(category, 'SYSTEM'), "
               "read = coalesce(read, FALSE), created_at = coalesce(created_at, now())")
    op.alter_column("notifications", "type", nullable=False, server_default="INFO", existing_type=sa.Enum(name="notificationtypeenum"))
    op.alter_column("notifications", "category", nullable=False, server_default="SYSTEM", existing_type=sa.Enum(name="notificationcategoryenum"))
    op.alter_column("notifications", "read", existing_type=sa.Boolean(), nullable=False, server_default=sa.false())
    op.alter_column("notifications", "created_at", existing_type=sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "read"])


def downgrade() -> None:
    """Best-effort, LOSSY downgrade to 3bbc99b4bf66.

    Prefer restoring the pre-upgrade pg_dump. New-only data (extension requests, event
    issues, transfer unit lists, approval metadata, request quantity/purpose) is dropped.
    """
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    for col in ("type", "category", "read", "created_at"):
        op.alter_column("notifications", col, nullable=True, server_default=None)

    # transfers back to model+quantity
    op.add_column("transfers", sa.Column("equipment_model_id", sa.Integer(), nullable=True))
    op.add_column("transfers", sa.Column("quantity", sa.Integer(), nullable=True))
    op.execute("""UPDATE transfers t SET quantity = s.n, equipment_model_id = s.model_id FROM (
                    SELECT tu.transfer_id, count(*) n, min(u.model_id) model_id FROM transfer_units tu
                    JOIN equipment_units u ON u.asset_id = tu.unit_asset_id GROUP BY 1) s WHERE s.transfer_id = t.id""")
    op.execute("DELETE FROM transfers WHERE equipment_model_id IS NULL")
    op.alter_column("transfers", "equipment_model_id", nullable=False)
    op.create_foreign_key("transfers_equipment_model_id_fkey", "transfers", "equipment_models",
                          ["equipment_model_id"], ["id"], ondelete="RESTRICT")
    op.drop_index("ix_transfer_units_unit_asset_id", table_name="transfer_units")
    op.drop_table("transfer_units")
    op.drop_constraint("ck_transfers_distinct_labs", "transfers", type_="check")
    op.drop_constraint("fk_transfers_decided_by_id", "transfers", type_="foreignkey")
    op.drop_constraint("fk_transfers_completed_by_id", "transfers", type_="foreignkey")
    for col in ("decision_reason", "decided_by_id", "completed_by_id"):
        op.drop_column("transfers", col)
    op.alter_column("transfers", "status", nullable=True, server_default=None)
    op.alter_column("transfers", "created_at", nullable=True, server_default=None)
    op.execute("ALTER TYPE transferstatusenum RENAME TO transferstatusenum_new")
    op.execute("CREATE TYPE transferstatusenum AS ENUM ('PENDING','APPROVED','REJECTED','COMPLETED')")
    op.execute("""ALTER TABLE transfers ALTER COLUMN status TYPE transferstatusenum USING (
                    CASE status::text WHEN 'CANCELLED' THEN 'REJECTED' ELSE status::text END)::transferstatusenum""")
    op.execute("DROP TYPE transferstatusenum_new")

    # transactions
    for name in ("uq_transactions_one_active_per_unit", "ix_transactions_lab_status",
                 "ix_transactions_request_id", "ix_transactions_borrower_id"):
        op.drop_index(name, table_name="transactions")
    for name in ("ck_transactions_due_after_issue", "ck_transactions_return_state",
                 "ck_transactions_return_after_issue", "ck_transactions_reissued_nonneg"):
        op.drop_constraint(name, "transactions", type_="check")
    op.drop_constraint("fk_transactions_issued_by_id", "transactions", type_="foreignkey")
    op.drop_constraint("fk_transactions_received_by_id", "transactions", type_="foreignkey")
    for col in ("issued_by_id", "received_by_id", "return_condition", "return_remarks"):
        op.drop_column("transactions", col)
    op.execute("ALTER TYPE transactionstatusenum RENAME TO transactionstatusenum_new")
    op.execute("CREATE TYPE transactionstatusenum AS ENUM ('ACTIVE','RETURNED','OVERDUE')")
    op.execute("ALTER TABLE transactions ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE transactions ALTER COLUMN status TYPE transactionstatusenum USING status::text::transactionstatusenum")
    op.execute("DROP TYPE transactionstatusenum_new")
    for col in ("request_id", "unit_asset_id", "borrower_id", "lab_id", "issue_date", "status",
                "reissued_count", "is_quick_borrow"):
        op.alter_column("transactions", col, nullable=True, server_default=None)
    for col in ("due_date", "return_date"):
        op.execute(f"ALTER TABLE transactions ALTER COLUMN {col} TYPE timestamp USING {col} AT TIME ZONE 'UTC'")

    # requests
    for name in ("ix_requests_requester_status", "ix_requests_lab_status"):
        op.drop_index(name, table_name="requests")
    for name in ("ck_requests_quantity_positive", "ck_requests_dates", "ck_requests_rejection_reason",
                 "ck_requests_event_link"):
        op.drop_constraint(name, "requests", type_="check")
    op.drop_index("uq_extension_requests_one_pending", table_name="extension_requests")
    op.drop_index("ix_extension_requests_request_id", table_name="extension_requests")
    op.drop_table("extension_requests")
    op.drop_constraint("fk_requests_decided_by_id", "requests", type_="foreignkey")
    op.drop_constraint("fk_requests_event_issue_id", "requests", type_="foreignkey")
    for col in ("kind", "quantity", "purpose", "rejection_reason", "decided_by_id", "decided_at",
                "event_issue_id", "created_at"):
        op.drop_column("requests", col)
    op.execute("ALTER TYPE requeststatusenum RENAME TO requeststatusenum_new")
    op.execute("CREATE TYPE requeststatusenum AS ENUM ('PENDING','APPROVED','ISSUED','RETURNED','REJECTED','EXTENSION_PENDING','EXTENDED')")
    op.execute("ALTER TABLE requests ALTER COLUMN status DROP DEFAULT")
    op.execute("""ALTER TABLE requests ALTER COLUMN status TYPE requeststatusenum USING (
                    CASE status::text WHEN 'CANCELLED' THEN 'REJECTED' ELSE status::text END)::requeststatusenum""")
    op.execute("DROP TYPE requeststatusenum_new")
    for col in ("requester_id", "model_id", "lab_id", "status"):
        op.alter_column("requests", col, nullable=True)
    for col in ("required_from", "required_until"):
        op.execute(f"ALTER TABLE requests ALTER COLUMN {col} TYPE timestamp USING {col} AT TIME ZONE 'UTC'")
    op.drop_table("event_issues")

    # units / models
    op.drop_table("asset_sequences")
    op.drop_index("ix_equipment_units_lab_status", table_name="equipment_units")
    op.drop_index("ix_equipment_units_model_id", table_name="equipment_units")
    op.drop_constraint("equipment_units_model_id_fkey", "equipment_units", type_="foreignkey")
    op.create_foreign_key("equipment_units_model_id_fkey", "equipment_units", "equipment_models",
                          ["model_id"], ["id"], ondelete="CASCADE")
    op.drop_constraint("equipment_units_lab_id_fkey", "equipment_units", type_="foreignkey")
    op.drop_column("equipment_units", "lab_id")
    op.execute("ALTER TABLE equipment_units ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE unitstatusenum RENAME TO unitstatusenum_new")
    op.execute("CREATE TYPE unitstatusenum AS ENUM ('AVAILABLE','ISSUED','MAINTENANCE')")
    op.execute("""ALTER TABLE equipment_units ALTER COLUMN status TYPE unitstatusenum USING (
                    CASE status::text WHEN 'IN_TRANSIT' THEN 'AVAILABLE' ELSE status::text END)::unitstatusenum""")
    op.execute("DROP TYPE unitstatusenum_new")
    op.alter_column("equipment_units", "status", nullable=True)
    op.alter_column("equipment_units", "model_id", nullable=True)
    op.drop_index("ix_equipment_models_lab_id", table_name="equipment_models")
    op.add_column("equipment_models", sa.Column("total_quantity", sa.Integer(), nullable=True))
    op.execute("UPDATE equipment_models m SET total_quantity = (SELECT count(*) FROM equipment_units u WHERE u.model_id = m.id)")
    op.alter_column("equipment_models", "equipment_type", nullable=True, server_default=None)
    op.alter_column("equipment_models", "lab_id", nullable=True)

    # labs + assignments
    op.drop_constraint("ck_labs_code_format", "labs", type_="check")
    op.drop_constraint("labs_code_key", "labs", type_="unique")
    op.alter_column("labs", "code", type_=sa.String(), nullable=True)
    op.alter_column("labs", "department_id", nullable=True)
    op.add_column("labs", sa.Column("incharge_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key("labs_incharge_user_id_fkey", "labs", "users", ["incharge_user_id"], ["id"], ondelete="SET NULL")
    op.add_column("users", sa.Column("assigned_labs", sa.JSON(), nullable=True))
    op.execute("UPDATE labs l SET incharge_user_id = a.assistant_id FROM lab_assistant_assignments a WHERE a.lab_id = l.id")
    op.execute("""UPDATE users u SET assigned_labs = s.labs FROM (
                    SELECT assistant_id, json_agg(lab_id ORDER BY lab_id) labs FROM lab_assistant_assignments GROUP BY 1) s
                  WHERE s.assistant_id = u.id""")
    op.drop_index("ix_lab_assistant_assignments_assistant_id", table_name="lab_assistant_assignments")
    op.drop_table("lab_assistant_assignments")

    # users
    for name in ("ck_users_role_email_domain", "ck_users_email_lowercase", "ck_users_university_id_uppercase",
                 "ck_users_admin_credentials"):
        op.drop_constraint(name, "users", type_="check")
    op.drop_constraint("users_university_id_key", "users", type_="unique")
    op.drop_constraint("users_activation_token_hash_key", "users", type_="unique")
    op.drop_constraint("fk_users_approved_by_id", "users", type_="foreignkey")
    for col in ("university_id", "account_status", "email_domain_exempt", "activation_token_hash",
                "activation_expires_at", "approved_by_id", "approved_at", "status_reason", "created_at",
                "deactivated_at"):
        op.drop_column("users", col)
    op.execute("UPDATE users SET hashed_password = '!' WHERE hashed_password IS NULL")  # unusable, login impossible
    op.alter_column("users", "hashed_password", nullable=False)

    for name in ("accountstatusenum", "requestkindenum", "extensionstatusenum"):
        op.execute(f"DROP TYPE IF EXISTS {name}")
    # legacy_column_values / legacy_transfers_v1 are intentionally kept (retention).
