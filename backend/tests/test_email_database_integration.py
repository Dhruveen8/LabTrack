"""Opt-in real PostgreSQL relationship checks; fixture rows always roll back.

LABTRACK_EMAIL_DB_TEST=1 enables these tests. No SMTP worker is run.
"""
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from app.db.models import (User, RoleEnum, Department, Lab, EquipmentModel, EquipmentUnit,
                           Request, Transaction, Notification, NotificationEmail)
from app.db.models import NotificationTypeEnum as NT, NotificationCategoryEnum as NC
from app.api.endpoints.notifications import create_notification
from app.services.email_content import prepare_email
from app.services import loan_reminders
from app.core.config import settings


@pytest.mark.skipif(os.getenv('LABTRACK_EMAIL_DB_TEST') != '1', reason='PostgreSQL integration is opt-in')
@pytest.mark.asyncio
async def test_database_values_four_templates_and_reminder_dedup(monkeypatch):
    suffix = uuid4().hex[:8]
    now = datetime.now(timezone.utc)
    monkeypatch.setattr(settings, 'SMTP_ENABLED', True)
    # Each pytest asyncio test owns a loop; never reuse pooled asyncpg connections.
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    async with engine.connect() as connection:
        outer = await connection.begin()
        try:
            async with AsyncSession(bind=connection, join_transaction_mode='create_savepoint', expire_on_commit=False) as db:
                user = User(name=f'Email borrower {suffix}', email=f'email.{suffix}@charusat.edu.in', role=RoleEnum.STUDENT)
                issuer = User(name=f'Email assistant {suffix}', email=f'email.{suffix}@charusat.ac.in', role=RoleEnum.ASSISTANT)
                department = Department(name='Email test department', code=f'EM{suffix}')
                db.add_all([user, issuer, department])
                await db.flush()
                lab = Lab(name=f'Loan lab {suffix}', code=f'EM{suffix.upper()}', department_id=department.id)
                moved_lab = Lab(name=f'Current unit lab {suffix}', code=f'EU{suffix.upper()}', department_id=department.id)
                db.add_all([lab, moved_lab])
                await db.flush()
                actual = EquipmentModel(name=f'Actual unit model {suffix}', category='MC', lab_id=lab.id)
                decoy = EquipmentModel(name=f'Request model {suffix}', category='OTHER', lab_id=lab.id)
                db.add_all([actual, decoy])
                await db.flush()
                unit = EquipmentUnit(asset_id=f'EMAIL-{suffix}', model_id=actual.id, lab_id=moved_lab.id)
                req = Request(requester_id=user.id, model_id=decoy.id, lab_id=lab.id,
                              required_from=now - timedelta(days=1), required_until=now + timedelta(hours=3))
                db.add_all([unit, req])
                await db.flush()
                loan = Transaction(request_id=req.id, unit_asset_id=unit.asset_id, borrower_id=user.id,
                                   lab_id=lab.id, issued_by_id=issuer.id, issue_date=now - timedelta(days=1),
                                   due_date=now + timedelta(hours=3))
                db.add(loan)
                await db.flush()
                for kind in ['login', 'issued', 'due_soon', 'overdue']:
                    clock = loan.due_date + timedelta(hours=2) if kind == 'overdue' else now
                    context = {'kind': kind, 'transaction_ids': [loan.id], 'due_date': loan.due_date.isoformat()}
                    notification = await create_notification(db, user.id, 'Test portal notification', 'Test body', NT.INFO, NC.SYSTEM, email_context=context)
                    await db.flush()
                    queued = await db.get(NotificationEmail, notification.id)
                    assert queued.email_context == context
                    content = await prepare_email(db, queued, notification, user, clock)
                    assert user.name in content.text
                    if kind != 'login':
                        assert actual.name in content.text and decoy.name not in content.text
                        assert lab.name in content.text and moved_lab.name not in content.text
                        assert unit.asset_id in content.text
                    if kind == 'issued':
                        assert issuer.name in content.text
                await db.commit()

                class BoundSession:
                    async def __aenter__(self):
                        return db
                    async def __aexit__(self, *args):
                        return False
                monkeypatch.setattr(loan_reminders, 'AsyncSessionLocal', BoundSession)
                # Restrict scheduling to fixtures; unrelated real loans must stay untouched.
                original = loan_reminders.select
                def fixture_select(entity):
                    statement = original(entity)
                    return statement.where(Transaction.id == loan.id) if entity is Transaction else statement
                monkeypatch.setattr(loan_reminders, 'select', fixture_select)
                await loan_reminders.queue_reminders(now)
                await loan_reminders.queue_reminders(now)
                count = await db.scalar(select(func.count(Notification.id)).where(
                    Notification.user_id == user.id, Notification.title == 'Equipment Due Soon'))
                assert count == 1
                await loan_reminders.queue_reminders(loan.due_date + timedelta(hours=2))
                await loan_reminders.queue_reminders(loan.due_date + timedelta(hours=2))
                count = await db.scalar(select(func.count(Notification.id)).where(
                    Notification.user_id == user.id, Notification.title == 'Equipment Overdue'))
                assert count == 1
                reminder = (await db.execute(select(Notification).where(
                    Notification.user_id == user.id, Notification.title == 'Equipment Due Soon'))).scalar_one()
                queued = await db.get(NotificationEmail, reminder.id)
                from app.db.models import TransactionStatusEnum
                loan.status, loan.return_date = TransactionStatusEnum.RETURNED, now
                await db.flush()
                assert await prepare_email(db, queued, reminder, user, now) is None
        finally:
            await outer.rollback()
