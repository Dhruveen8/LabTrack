"""Persist one reminder per loan, deadline and reminder kind without new tables."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models import (Transaction, TransactionStatusEnum, Notification,
                           NotificationTypeEnum, NotificationCategoryEnum)
from app.api.endpoints.notifications import create_notification

logger = logging.getLogger(__name__)


def reminder_content(loan, now):
    if loan.status != TransactionStatusEnum.ACTIVE or loan.return_date is not None:
        return None
    if loan.due_date > now + timedelta(hours=24):
        return None
    overdue = loan.due_date <= now
    title = 'Equipment Overdue' if overdue else 'Equipment Due Soon'
    action = 'is overdue' if overdue else 'is due within 24 hours'
    # The stable body identifies the loan and deadline for durable deduplication.
    message = (f'Asset {loan.unit_asset_id} {action}. Due: {loan.due_date.isoformat()}. '
               f'Loan #{loan.id}. Please return the equipment to the lab.')
    return title, message


async def queue_reminders(now=None):
    now = now or datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        # Serialize schedulers on each loan, including across server processes.
        loans = (await db.execute(select(Transaction).where(
            Transaction.status == TransactionStatusEnum.ACTIVE,
            Transaction.return_date.is_(None),
            Transaction.due_date <= now + timedelta(hours=24)
        ).order_by(Transaction.id).with_for_update(skip_locked=True))).scalars().all()
        for loan in loans:
            title, message = reminder_content(loan, now)
            existing = (await db.execute(select(Notification.id).where(
                Notification.user_id == loan.borrower_id,
                Notification.title == title, Notification.message == message
            ).limit(1))).scalar_one_or_none()
            if existing is None:
                await create_notification(db, loan.borrower_id, title, message,
                                          NotificationTypeEnum.WARNING,
                                          NotificationCategoryEnum.CHECKOUT,
                                          email_context={
                                              'kind': 'overdue' if loan.due_date <= now else 'due_soon',
                                              'transaction_ids': [loan.id],
                                              'due_date': loan.due_date.isoformat(),
                                          })
        await db.commit()


async def reminder_worker(stop: asyncio.Event):
    while not stop.is_set():
        try:
            await queue_reminders()
        except Exception as error:
            logger.warning('Loan reminder queue unavailable (%s)', type(error).__name__)
        try:
            await asyncio.wait_for(stop.wait(), timeout=60)
        except asyncio.TimeoutError:
            pass
