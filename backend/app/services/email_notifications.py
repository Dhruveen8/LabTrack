"""Deliver committed notifications through Gmail API or SMTP with bounded retries."""
import asyncio
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
import logging
import smtplib
import ssl

from sqlalchemy import select
from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models import Notification, NotificationEmail, User
from app.services.gmail_api import gmail_sender

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5


def send_email(recipient: str, title: str, body: str, notification_id: int):
    message = EmailMessage()
    gmail = settings.EMAIL_PROVIDER == 'gmail_api'
    sender = settings.GMAIL_FROM_EMAIL if gmail else settings.SMTP_FROM_EMAIL
    sender_name = settings.GMAIL_FROM_NAME if gmail else settings.SMTP_FROM_NAME
    message['From'] = formataddr((sender_name, sender))
    message['To'] = recipient
    message['Subject'] = f'LabTrack: {title}'
    message['Message-ID'] = f'<labtrack-notification-{notification_id}@{sender.split("@")[-1]}>'
    message.set_content(f'{body}\n\nOpen the LabTrack portal to view your notification.\n')
    if gmail:
        gmail_sender.send(message)
        return
    context = ssl.create_default_context()
    smtp_class = smtplib.SMTP_SSL if settings.SMTP_USE_SSL else smtplib.SMTP
    options = {'timeout': settings.SMTP_TIMEOUT_SECONDS}
    if settings.SMTP_USE_SSL:
        options['context'] = context
    with smtp_class(settings.SMTP_HOST, settings.SMTP_PORT, **options) as smtp:
        if not settings.SMTP_USE_SSL:
            smtp.starttls(context=context)
        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD.get_secret_value().replace(' ', ''))
        smtp.send_message(message)


async def deliver_one() -> bool:
    if not settings.email_ready:
        return False
    async with AsyncSessionLocal() as db:
        # Separate server workers cannot pick the same queued row concurrently.
        row = (await db.execute(select(NotificationEmail, Notification, User.email)
            .join(Notification, Notification.id == NotificationEmail.notification_id)
            .join(User, User.id == Notification.user_id)
            .where(NotificationEmail.sent_at.is_(None), NotificationEmail.failed.is_(False),
                   NotificationEmail.next_attempt_at <= datetime.now(timezone.utc))
            .order_by(NotificationEmail.next_attempt_at, NotificationEmail.notification_id)
            .with_for_update(of=NotificationEmail, skip_locked=True).limit(1))).first()
        if row is None:
            return False
        queued, notification, recipient = row
        queued.attempts += 1
        try:
            await asyncio.to_thread(send_email, recipient, notification.title,
                                    notification.message or notification.title, notification.id)
            queued.sent_at = datetime.now(timezone.utc)
        except Exception as error:
            # Do not log credentials, message bodies or SMTP responses.
            logger.warning('Notification email %s failed (%s); attempt %s',
                           notification.id, type(error).__name__, queued.attempts)
            queued.failed = queued.attempts >= MAX_ATTEMPTS
            queued.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=60 * 2 ** (queued.attempts - 1))
        await db.commit()
        return True


async def email_worker(stop: asyncio.Event):
    if not settings.email_ready:
        if settings.email_enabled:
            logger.warning('Notification mail is enabled but sender configuration is incomplete')
        return
    while not stop.is_set():
        try:
            worked = await deliver_one()
        except Exception as error:
            logger.warning('Notification email queue unavailable (%s)', type(error).__name__)
            worked = False
        if not worked:
            try:
                await asyncio.wait_for(stop.wait(), timeout=15)
            except asyncio.TimeoutError:
                pass
