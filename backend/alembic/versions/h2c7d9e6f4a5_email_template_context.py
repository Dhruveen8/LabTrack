"""Attach typed template/transaction references to existing outgoing mail.

Revision ID: h2c7d9e6f4a5
Revises: g1b6c8d5e3f4
"""
from alembic import op
import sqlalchemy as sa

revision = 'h2c7d9e6f4a5'
down_revision = 'g1b6c8d5e3f4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('notification_emails', sa.Column('email_context', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('notification_emails', 'email_context')
