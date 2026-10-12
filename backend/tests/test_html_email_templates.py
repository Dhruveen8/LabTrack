"""Rendering and delivery regressions: SMTP is mocked; no outbound emails."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql
from app.db.models import NotificationEmail, TransactionStatusEnum
from app.services import email_notifications as mail
from app.services.email_content import prepare_email
from app.services.email_templates import render_login, render_equipment
from test_smtp_notifications import smtp, session

NOW = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)
SUBJECTS = {
    'login': 'New Login to LabTrack',
    'issued': 'Equipment Issued Successfully – LabTrack',
    'due_soon': 'Reminder: Equipment Return Due Soon – LabTrack',
    'overdue': 'Overdue Equipment Return – LabTrack',
}


def records(kind):
    user = NS(id=5, name='Student <script>alert(1)</script>', email='student@charusat.edu.in')
    due = NOW + timedelta(hours=-2 if kind == 'overdue' else 3)
    loan = NS(id=7, borrower_id=user.id, unit_asset_id='UNIT<&7',
              issue_date=NOW - timedelta(days=2), due_date=due,
              status=TransactionStatusEnum.ACTIVE, return_date=None)
    model = NS(name='Oscilloscope & probes', category='Measurement')
    lab, issuer = NS(name='Electronics <Lab>'), NS(name='Assistant & Name')
    context = {'kind': kind, 'transaction_ids': [loan.id], 'due_date': due.isoformat()}
    queued = NotificationEmail(notification_id=101, attempts=0, email_context=context)
    notification = NS(id=101, user_id=5, title='Existing portal title',
                      message='Existing portal body', created_at=NOW)
    result = MagicMock()
    result.all.return_value = [(loan, model, lab, issuer)]
    db = NS(execute=AsyncMock(return_value=result))
    return db, queued, notification, user, loan


@pytest.mark.asyncio
@pytest.mark.parametrize('kind', SUBJECTS)
async def test_all_four_content_scenarios(kind):
    db, queued, notification, user, loan = records(kind)
    content = await prepare_email(db, queued, notification, user, NOW)
    assert content.subject == SUBJECTS[kind]
    assert user.name in content.text
    assert '<script>' not in content.html
    assert '&lt;script&gt;' in content.html
    assert '<meta name="viewport"' in content.html
    assert 'max-width:480px' in content.html
    assert 'password' not in content.text.lower() and 'token' not in content.text.lower()
    if kind == 'login':
        assert '11 Oct 2026, 05:30 PM IST (UTC+05:30)' in content.text
        assert 'contact your administrator' in content.text
        db.execute.assert_not_awaited()
    else:
        assert 'Oscilloscope & probes' in content.text and 'UNIT<&7' in content.text
        assert 'Electronics &lt;Lab&gt;' in content.html
        statement = str(db.execute.call_args.args[0].compile(dialect=postgresql.dialect()))
        assert 'equipment_units.asset_id = transactions.unit_asset_id' in statement
        assert 'equipment_models.id = equipment_units.model_id' in statement
        assert 'transactions.borrower_id' in statement
        if kind == 'issued':
            assert 'Measurement' in content.text and 'Assistant & Name' in content.text
            assert 'Issued date and time' in content.text and 'Due date and time' in content.text
        elif kind == 'due_soon':
            assert 'Remaining time: 3 hours' in content.text and 'within 24 hours' in content.text
        else:
            assert 'Overdue duration: 2 hours' in content.text


@pytest.mark.asyncio
@pytest.mark.parametrize('kind', SUBJECTS)
async def test_worker_sends_multipart_to_registered_user(kind, smtp, monkeypatch):
    db, queued, notification, user, loan = records(kind)
    first = MagicMock()
    first.first.return_value = (queued, notification, user)
    details = MagicMock()
    details.all.return_value = [(loan, NS(name='Equipment', category='MC'), NS(name='Lab'), None)]
    db.execute = AsyncMock(side_effect=[first, details])
    db.commit = AsyncMock()
    session(monkeypatch, mail, db)
    # Use the fixed clock in content preparation; the worker uses real UTC for sent_at.
    async def prepare(*args):
        return await prepare_email(*args, now=NOW)
    monkeypatch.setattr(mail, 'prepare_email', prepare)
    assert await mail.deliver_one()
    message = smtp[1].send_message.call_args.args[0]
    assert message['To'] == user.email
    assert message['Subject'] == SUBJECTS[kind]
    assert message.get_content_type() == 'multipart/alternative'
    assert [part.get_content_type() for part in message.iter_parts()] == ['text/plain', 'text/html']
    assert queued.sent_at is not None


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['returned', 'deadline_changed', 'expired', 'too_early'])
async def test_stale_due_reminder_is_suppressed(change):
    db, queued, notification, user, loan = records('due_soon')
    if change == 'returned':
        loan.status, loan.return_date = TransactionStatusEnum.RETURNED, NOW
    elif change == 'deadline_changed':
        loan.due_date += timedelta(days=1)
    elif change == 'expired':
        loan.due_date = NOW
        queued.email_context['due_date'] = loan.due_date.isoformat()
    else:
        loan.due_date = NOW + timedelta(days=2)
        queued.email_context['due_date'] = loan.due_date.isoformat()
    assert await prepare_email(db, queued, notification, user, NOW) is None


@pytest.mark.asyncio
async def test_reminder_suppression_never_calls_smtp(smtp, monkeypatch):
    db, queued, notification, user, _ = records('due_soon')
    first = MagicMock()
    first.first.return_value = (queued, notification, user)
    db.execute = AsyncMock(return_value=first)
    db.commit = AsyncMock()
    session(monkeypatch, mail, db)
    monkeypatch.setattr(mail, 'prepare_email', AsyncMock(return_value=None))
    assert await mail.deliver_one()
    smtp[0].assert_not_called()
    assert queued.sent_at is None and queued.failed


@pytest.mark.asyncio
async def test_missing_or_wrong_borrower_transaction_is_rejected():
    db, queued, notification, user, _ = records('issued')
    db.execute.return_value.all.return_value = []
    with pytest.raises(ValueError):
        await prepare_email(db, queued, notification, user, NOW)


def test_optional_fields_and_batch_units():
    _, _, _, _, loan = records('issued')
    other = NS(**vars(loan))
    other.unit_asset_id = 'SECOND-UNIT'
    content = render_equipment('issued', '', [
        (loan, NS(name='First equipment', category=None), None, None),
        (other, NS(name='Second equipment', category='MC'), NS(name='Lab B'), NS(name='')),
    ], NOW)
    assert 'Hello there,' in content.text
    assert 'Not recorded' in content.text and 'Not available' in content.text
    assert 'SECOND-UNIT' in content.text and 'Second equipment' in content.html


@pytest.mark.asyncio
async def test_pre_upgrade_reminder_keeps_exact_loan_reference():
    db, queued, notification, user, loan = records('due_soon')
    queued.email_context = None
    notification.title = 'Equipment Due Soon'
    notification.message = f'Asset {loan.unit_asset_id} is due within 24 hours. Due: {loan.due_date.isoformat()}. Loan #{loan.id}. Please return the equipment to the lab.'
    assert (await prepare_email(db, queued, notification, user, NOW)).subject == SUBJECTS['due_soon']


@pytest.mark.asyncio
async def test_successful_login_queues_login_template(monkeypatch):
    from app.api.endpoints import auth
    from app.db.models import AccountStatusEnum, RoleEnum
    result = MagicMock()
    result.scalars.return_value.first.return_value = NS(
        id=1, role=RoleEnum.STUDENT, account_status=AccountStatusEnum.ACTIVE, hashed_password='hash')
    db = NS(execute=AsyncMock(return_value=result), commit=AsyncMock())
    monkeypatch.setattr(auth.security, 'verify_password', lambda *args: True)
    monkeypatch.setattr(auth.security, 'create_access_token', lambda **kwargs: 'token')
    create = AsyncMock()
    monkeypatch.setattr(auth, 'create_notification', create)
    assert (await auth.login(db, NS(username='student', password='private')))['access_token'] == 'token'
    assert create.call_args.kwargs['email_context'] == {'kind': 'login'}
