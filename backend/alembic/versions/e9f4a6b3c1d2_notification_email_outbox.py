"""Persistent outgoing notification mail.

Revision ID: e9f4a6b3c1d2
Revises: d8e3f5a2b0c1
"""
from alembic import op
import sqlalchemy as sa

revision = 'e9f4a6b3c1d2'
down_revision = 'd8e3f5a2b0c1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('notification_emails',
        sa.Column('notification_id', sa.Integer(), sa.ForeignKey('notifications.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('failed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade():
    op.drop_table('notification_emails')
