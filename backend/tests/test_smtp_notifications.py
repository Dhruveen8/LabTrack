from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import smtplib
from pydantic import SecretStr
from app.core.config import Settings, settings
from app.services import email_notifications as mail, loan_reminders as reminders
from app.db.models import TransactionStatusEnum, NotificationEmail


@pytest.fixture
def smtp(monkeypatch):
    monkeypatch.setattr(settings, 'SMTP_USER', 'sender@gmail.com')
    monkeypatch.setattr(settings, 'SMTP_PASSWORD', SecretStr('abcd efgh ijkl mnop'))
    monkeypatch.setattr(settings, 'SMTP_ENABLED', True)
    client = MagicMock()
    client.__enter__.return_value = client
    client.send_message.return_value = {}
    factory = MagicMock(return_value=client)
    monkeypatch.setattr(mail.smtplib, 'SMTP', factory)
    return factory, client


@pytest.mark.parametrize('title,body', [
    ('Successful Login', 'You have successfully signed in to LabTrack.'),
    ('Equipment Checked Out', 'Asset ABC has been issued to you.'),
    ('Equipment Due Soon', 'Due within 24 hours'),
    ('Equipment Overdue', 'Please return equipment'),
    ('Equipment Returned', 'Thank you'),
])
def test_templates_and_starttls(smtp, title, body):
    factory, client = smtp
    mail.send_email('borrower@example.test', title, body, 123)
    factory.assert_called_once_with('smtp.gmail.com', 587, timeout=settings.SMTP_TIMEOUT_SECONDS)
    assert [call[0] for call in client.method_calls] == ['ehlo', 'starttls', 'ehlo', 'login', 'send_message']
    client.login.assert_called_once_with('sender@gmail.com', 'abcdefghijklmnop')
    message = client.send_message.call_args.args[0]
    assert message['Subject'] == f'LabTrack: {title}'
    assert message['Message-ID'] == '<labtrack-notification-123@gmail.com>'
    assert body in message.get_content()


def test_refused_recipient_is_failure(smtp):
    smtp[1].send_message.return_value = {'borrower@example.test': (550, b'private response')}
    with pytest.raises(smtplib.SMTPRecipientsRefused):
        mail.send_email('borrower@example.test', 'Test', 'Test', 1)


def test_settings():
    config = Settings(_env_file=None, SECRET_KEY='test', SMTP_USER='', SMTP_PASSWORD='')
    assert not config.email_ready
    config.SMTP_USER = 'sender@gmail.com'
    config.SMTP_PASSWORD = SecretStr('app-password')
    assert config.email_ready
    config.SMTP_ENABLED = False
    assert not config.email_ready


def loan(now, hours=24):
    return SimpleNamespace(id=1, borrower_id=2, unit_asset_id='ABC',
                           due_date=now + timedelta(hours=hours), return_date=None,
                           status=TransactionStatusEnum.ACTIVE)


def test_reminder_boundaries_and_returns():
    now = datetime.now(timezone.utc)
    assert reminders.reminder_content(loan(now, 24.01), now) is None
    assert reminders.reminder_content(loan(now), now)[0] == 'Equipment Due Soon'
    assert reminders.reminder_content(loan(now, 0), now)[0] == 'Equipment Overdue'
    returned = loan(now, -1)
    returned.status = TransactionStatusEnum.RETURNED
    returned.return_date = now
    assert reminders.reminder_content(returned, now) is None
    assert reminders.reminder_content(loan(now, 1), now) != reminders.reminder_content(loan(now, 2), now)


def session(monkeypatch, module, db):
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=db)
    context.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(module, 'AsyncSessionLocal', lambda: context)


@pytest.mark.asyncio
async def test_reminders_are_not_queued_twice(monkeypatch):
    now = datetime.now(timezone.utc)
    rows = MagicMock()
    rows.scalars.return_value.all.return_value = [loan(now)]
    absent, present = MagicMock(), MagicMock()
    absent.scalar_one_or_none.return_value = None
    present.scalar_one_or_none.return_value = 10
    db = SimpleNamespace(execute=AsyncMock(side_effect=[rows, absent, rows, present]), commit=AsyncMock())
    session(monkeypatch, reminders, db)
    create = AsyncMock()
    monkeypatch.setattr(reminders, 'create_notification', create)
    await reminders.queue_reminders(now)
    await reminders.queue_reminders(now)
    create.assert_awaited_once()
    sql = str(db.execute.call_args_list[0].args[0].compile(dialect=__import__('sqlalchemy').dialects.postgresql.dialect()))
    assert 'FOR UPDATE SKIP LOCKED' in sql


@pytest.mark.asyncio
@pytest.mark.parametrize('attempts', [0, 4])
async def test_delivery_failure_retries_without_raising(smtp, monkeypatch, caplog, attempts):
    queued = NotificationEmail(notification_id=1, attempts=attempts)
    notification = SimpleNamespace(id=1, title='Equipment Checked Out', message='private body')
    result = MagicMock()
    result.first.return_value = (queued, notification, SimpleNamespace(id=2, name='Borrower', email='borrower@example.test'))
    db = SimpleNamespace(execute=AsyncMock(return_value=result), commit=AsyncMock())
    session(monkeypatch, mail, db)
    smtp[1].login.side_effect = smtplib.SMTPAuthenticationError(535, b'private password response')
    assert await mail.deliver_one()
    assert queued.sent_at is None and queued.attempts == attempts + 1
    assert queued.failed == (attempts == 4)
    db.commit.assert_awaited_once()
    assert 'SMTPAuthenticationError' in caplog.text
    assert 'private' not in caplog.text


@pytest.mark.asyncio
async def test_success_marks_sent(smtp, monkeypatch):
    queued = NotificationEmail(notification_id=1, attempts=0)
    result = MagicMock()
    result.first.return_value = (queued, SimpleNamespace(id=1, title='Test', message='Test'), SimpleNamespace(id=2, name='Borrower', email='borrower@example.test'))
    db = SimpleNamespace(execute=AsyncMock(return_value=result), commit=AsyncMock())
    session(monkeypatch, mail, db)
    assert await mail.deliver_one()
    assert queued.sent_at is not None


@pytest.mark.asyncio
async def test_login_survives_notification_failure(monkeypatch):
    from app.api.endpoints import auth
    from app.db.models import AccountStatusEnum, RoleEnum
    user = SimpleNamespace(id=1, account_status=AccountStatusEnum.ACTIVE,
                           role=RoleEnum.STUDENT, hashed_password='hash')
    result = MagicMock()
    result.scalars.return_value.first.return_value = user
    db = SimpleNamespace(execute=AsyncMock(return_value=result), rollback=AsyncMock(), commit=AsyncMock())
    monkeypatch.setattr(auth.security, 'verify_password', lambda *args: True)
    monkeypatch.setattr(auth.security, 'create_access_token', lambda **kwargs: 'token')
    create = AsyncMock(side_effect=RuntimeError('queue unavailable'))
    monkeypatch.setattr(auth, 'create_notification', create)
    response = await auth.login(db, SimpleNamespace(username='student', password='test'))
    assert response['access_token'] == 'token'
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('category', ['SYSTEM', 'CHECKOUT', 'RETURN'])
async def test_notification_and_email_share_transaction(smtp, category):
    from app.api.endpoints.notifications import create_notification
    from app.db.models import Notification, NotificationTypeEnum, NotificationCategoryEnum
    added = []
    async def flush():
        added[0].id = 42
    db = SimpleNamespace(add=added.append, flush=flush)
    await create_notification(db, 1, 'Existing title', 'Existing template',
                              NotificationTypeEnum.INFO, NotificationCategoryEnum(category))
    assert isinstance(added[0], Notification)
    assert isinstance(added[1], NotificationEmail)
    assert added[1].notification_id == 42
    assert added[0].message == 'Existing template'


def test_postgres_url_normalized_without_changing_password():
    from sqlalchemy.engine import make_url
    config = Settings(_env_file=None, SECRET_KEY='test', DATABASE_URL='postgresql://user:a%40b%2Fc@host/db?sslmode=require')
    url = make_url(config.SQLALCHEMY_DATABASE_URI)
    assert url.drivername == 'postgresql+asyncpg'
    assert url.password == 'a@b/c' and url.query['ssl'] == 'require' and 'sslmode' not in url.query


def test_postgres_component_credentials_are_escaped():
    from sqlalchemy.engine import make_url
    config = Settings(_env_file=None, SECRET_KEY='test', POSTGRES_PASSWORD='a@b/c#%:')
    assert make_url(config.SQLALCHEMY_DATABASE_URI).password == 'a@b/c#%:'
