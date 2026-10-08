"""Request equipment types and quantities before assistant allocation."""
from alembic import op
import sqlalchemy as sa

revision = 'g1b6c8d5e3f4'
down_revision = 'f0a5b7c4d2e3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('event_requests', sa.Column('requested_items', sa.JSON(), nullable=False, server_default=sa.text("'[]'")))


def downgrade():
    op.drop_column('event_requests', 'requested_items')
