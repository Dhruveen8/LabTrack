"""Department faculty/HOD approvals and reservation deadlines."""
from alembic import op
import sqlalchemy as sa

revision = 'j4e9f1a8b6c7'
down_revision = 'i3d8e0f7a5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('is_hod', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_check_constraint('ck_users_hod_faculty', 'users', "NOT is_hod OR (role = 'FACULTY' AND department_id IS NOT NULL)")
    op.create_index('uq_department_hod', 'users', ['department_id'], unique=True, postgresql_where=sa.text('is_hod'))
    op.add_column('equipment_models', sa.Column('requires_hod_approval', sa.Boolean(), nullable=False, server_default=sa.false()))
    for table, fields in [('requests', ['faculty_id', 'hod_id']), ('event_requests', ['hod_id'])]:
        for field in fields:
            op.add_column(table, sa.Column(field, sa.Integer(), sa.ForeignKey('users.id', ondelete='RESTRICT')))
    for table, fields in [('requests', ['faculty_approved_at', 'hod_approved_at', 'approval_deadline']),
                          ('event_requests', ['hod_approved_at', 'approval_deadline', 'collection_deadline']),
                          ('request_items', ['collection_deadline'])]:
        for field in fields:
            op.add_column(table, sa.Column(field, sa.DateTime(timezone=True)))
    op.add_column('requests', sa.Column('approval_history', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('request_items', sa.Column('requires_hod_approval', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.drop_constraint('ck_event_requests_status', 'event_requests', type_='check')
    op.create_check_constraint('ck_event_requests_status', 'event_requests', "status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')")


def downgrade():
    raise RuntimeError('Restore the verified database backup to roll back the approval workflow safely')
