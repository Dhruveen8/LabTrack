"""Assistant-approved event requests and three-digit assistant identifiers."""
from alembic import op
import sqlalchemy as sa

revision = 'f0a5b7c4d2e3'
down_revision = 'e9f4a6b3c1d2'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    count = connection.execute(sa.text("SELECT count(*) FROM users WHERE role = 'ASSISTANT'")).scalar_one()
    if count > 999:
        raise RuntimeError('Three-digit assistant IDs support at most 999 assistants')
    op.add_column('users', sa.Column('assistant_number', sa.Integer(), nullable=True))
    connection.execute(sa.text("""WITH numbered AS (
        SELECT id, row_number() OVER (ORDER BY id) AS number FROM users WHERE role = 'ASSISTANT'
    ) UPDATE users SET assistant_number = numbered.number FROM numbered WHERE users.id = numbered.id"""))
    op.create_unique_constraint('uq_users_assistant_number', 'users', ['assistant_number'])
    op.create_check_constraint('ck_users_assistant_number', 'users', 'assistant_number IS NULL OR assistant_number BETWEEN 1 AND 999')
    connection.execute(sa.text("""INSERT INTO asset_sequences(prefix, last_value)
        VALUES ('assistant-display', :count) ON CONFLICT(prefix) DO UPDATE
        SET last_value = greatest(asset_sequences.last_value, excluded.last_value)"""), {'count': count})
    op.create_table('event_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('event_name', sa.String(200), nullable=False),
        sa.Column('purpose', sa.Text(), nullable=False),
        sa.Column('coordinator_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('lab_id', sa.Integer(), sa.ForeignKey('labs.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('unit_asset_ids', sa.JSON(), nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(16), nullable=False, server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decided_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('event_issue_id', sa.Integer(), sa.ForeignKey('event_issues.id', ondelete='RESTRICT'), nullable=True),
        sa.UniqueConstraint('event_issue_id'),
        sa.CheckConstraint("status IN ('PENDING', 'APPROVED', 'REJECTED')", name='ck_event_requests_status'),
        sa.CheckConstraint("(status = 'APPROVED') = (event_issue_id IS NOT NULL)", name='ck_event_requests_issue'),
        sa.CheckConstraint("status <> 'REJECTED' OR rejection_reason IS NOT NULL", name='ck_event_requests_rejection'),
    )
    op.create_index('ix_event_requests_lab_status', 'event_requests', ['lab_id', 'status'])


def downgrade():
    op.drop_table('event_requests')
    op.drop_constraint('ck_users_assistant_number', 'users')
    op.drop_constraint('uq_users_assistant_number', 'users')
    op.drop_column('users', 'assistant_number')
