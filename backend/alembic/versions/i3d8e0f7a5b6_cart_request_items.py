"""Cart drafts and atomic multi-equipment allocations on existing requests.

Revision ID: i3d8e0f7a5b6
Revises: h2c7d9e6f4a5
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision = 'i3d8e0f7a5b6'
down_revision = 'h2c7d9e6f4a5'
branch_labels = None
depends_on = None


def upgrade():
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE unitstatusenum ADD VALUE IF NOT EXISTS 'RESERVED'")
    status = ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ISSUED', 'RETURNED', name='requeststatusenum', create_type=False)
    op.add_column('requests', sa.Column('submission_key', sa.String(36), nullable=True))
    op.create_unique_constraint('uq_requests_submission_key', 'requests', ['submission_key'])
    op.create_table('request_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('request_id', sa.Integer(), sa.ForeignKey('requests.id', ondelete='CASCADE'), nullable=False),
        sa.Column('model_id', sa.Integer(), sa.ForeignKey('equipment_models.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('lab_id', sa.Integer(), sa.ForeignKey('labs.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('status', status, nullable=False, server_default='PENDING'),
        sa.UniqueConstraint('request_id', 'model_id', 'lab_id', name='uq_request_item_model_lab'),
        sa.CheckConstraint('quantity > 0', name='ck_request_item_quantity'))
    op.create_index('ix_request_items_request_id', 'request_items', ['request_id'])
    op.create_table('request_allocations',
        sa.Column('asset_id', sa.String(), sa.ForeignKey('equipment_units.asset_id', ondelete='RESTRICT'), primary_key=True),
        sa.Column('request_item_id', sa.Integer(), sa.ForeignKey('request_items.id', ondelete='CASCADE'), nullable=False))
    op.create_index('ix_request_allocations_request_item_id', 'request_allocations', ['request_item_id'])
    op.create_table('cart_items',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('model_id', sa.Integer(), sa.ForeignKey('equipment_models.id', ondelete='RESTRICT'), primary_key=True),
        sa.Column('lab_id', sa.Integer(), sa.ForeignKey('labs.id', ondelete='RESTRICT'), primary_key=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.CheckConstraint('quantity BETWEEN 1 AND 500', name='ck_cart_quantity'))
    op.add_column('transactions', sa.Column('request_item_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_transactions_request_item', 'transactions', 'request_items', ['request_item_id'], ['id'], ondelete='RESTRICT')
    op.create_index('ix_transactions_request_item_id', 'transactions', ['request_item_id'])


def downgrade():
    # Never release reservations through an implicit schema rollback.
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM request_allocations) THEN RAISE EXCEPTION 'Release request allocations before downgrading'; END IF; END $$")
    op.drop_index('ix_transactions_request_item_id', table_name='transactions')
    op.drop_constraint('fk_transactions_request_item', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'request_item_id')
    op.drop_table('cart_items')
    op.drop_table('request_allocations')
    op.drop_table('request_items')
    op.drop_constraint('uq_requests_submission_key', 'requests', type_='unique')
    op.drop_column('requests', 'submission_key')
    # PostgreSQL enum values are additive; RESERVED is retained but unused.
