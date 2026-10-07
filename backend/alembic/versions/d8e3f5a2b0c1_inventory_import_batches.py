"""Remember imported batches to prevent duplicate stock on retries.

Revision ID: d8e3f5a2b0c1
Revises: c7d2e4f1a9b0
"""
from alembic import op
import sqlalchemy as sa

revision = "d8e3f5a2b0c1"
down_revision = "c7d2e4f1a9b0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "inventory_import_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lab_id", sa.Integer(), sa.ForeignKey("labs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("lab_id", "content_hash", name="uq_inventory_import_batch"),
    )


def downgrade():
    op.drop_table("inventory_import_batches")
