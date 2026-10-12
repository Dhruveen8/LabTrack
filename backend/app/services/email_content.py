"""Resolve exact outbox references using the transaction's physical unit/model."""
from datetime import datetime, timedelta, timezone
import re
from sqlalchemy import select
from sqlalchemy.orm import aliased
from app.db.models import (Transaction, TransactionStatusEnum, EquipmentUnit,
                           EquipmentModel, Lab, User)
from app.services.email_templates import branded_email, render_login, render_equipment


async def prepare_email(db, queued, notification, user, now=None):
    now = now or datetime.now(timezone.utc)
    context = queued.email_context or {}
    kind = context.get('kind')
    if kind == 'login' or notification.title == 'Successful Login':
        return render_login(user.name, notification.created_at)
    # Existing reminder records have an explicit loan ID, unlike old issuance text.
    # Upgrade these safely without guessing from asset names or request.model_id.
    if not kind and notification.title in ('Equipment Due Soon', 'Equipment Overdue'):
        match = re.search(r'Loan #(\d+)\.', notification.message or '')
        deadline = re.search(r'Due: ([^ ]+)\. Loan #', notification.message or '')
        if match and deadline:
            kind = 'due_soon' if notification.title == 'Equipment Due Soon' else 'overdue'
            context = {'transaction_ids': [int(match[1])], 'due_date': deadline[1]}
    if kind in ('issued', 'due_soon', 'overdue'):
        ids = context.get('transaction_ids') or []
        if not ids or any(type(value) is not int for value in ids):
            raise ValueError('Email transaction reference missing')
        issuer = aliased(User)
        rows = (await db.execute(
            select(Transaction, EquipmentModel, Lab, issuer)
            .join(EquipmentUnit, EquipmentUnit.asset_id == Transaction.unit_asset_id)
            .join(EquipmentModel, EquipmentModel.id == EquipmentUnit.model_id)
            .outerjoin(Lab, Lab.id == Transaction.lab_id)
            .outerjoin(issuer, issuer.id == Transaction.issued_by_id)
            .where(Transaction.id.in_(ids), Transaction.borrower_id == user.id)
            .order_by(Transaction.id)
        )).all()
        if len(rows) != len(set(ids)):
            raise ValueError('Email transaction reference unavailable')
        if kind != 'issued':
            deadline = datetime.fromisoformat(context['due_date'])
            for loan, *_ in rows:
                if (loan.status != TransactionStatusEnum.ACTIVE or loan.return_date is not None
                        or loan.due_date != deadline):
                    return None
                if kind == 'due_soon' and not now < loan.due_date <= now + timedelta(hours=24):
                    return None
                if kind == 'overdue' and loan.due_date > now:
                    return None
        return render_equipment(kind, user.name, rows, now)
    # Preserve unrelated and pre-upgrade issuance notifications as generic emails.
    return branded_email(f'LabTrack: {notification.title}', user.name,
                         notification.message or notification.title, [],
                         'Open the LabTrack portal to view your notification.')
