"""Deliver committed notifications through Gmail SMTP with bounded retries."""
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
from app.services.email_content import prepare_email

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5


def send_email(recipient: str, title: str, body: str, notification_id: int, *, html=None, subject=None):
    message = EmailMessage()
    sender = settings.SMTP_USER
    sender_name = settings.SMTP_FROM_NAME
    message['From'] = formataddr((sender_name, sender))
    message['To'] = recipient
    message['Subject'] = subject or f'LabTrack: {title}'
    message['Message-ID'] = f'<labtrack-notification-{notification_id}@{sender.split("@")[-1]}>'
    message.set_content(body if html else f'{body}\n\nOpen the LabTrack portal to view your notification.\n')
    if html:
        message.add_alternative(html, subtype='html')
    context = ssl.create_default_context()
    with smtplib.SMTP('smtp.gmail.com', 587, timeout=settings.SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD.get_secret_value().replace(' ', ''))
        refused = smtp.send_message(message)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)



async def deliver_one() -> bool:
    if not settings.email_ready:
        return False
    async with AsyncSessionLocal() as db:
        # Separate server workers cannot pick the same queued row concurrently.
        row = (await db.execute(select(NotificationEmail, Notification, User)
            .join(Notification, Notification.id == NotificationEmail.notification_id)
            .join(User, User.id == Notification.user_id)
            .where(NotificationEmail.sent_at.is_(None), NotificationEmail.failed.is_(False),
                   NotificationEmail.next_attempt_at <= datetime.now(timezone.utc))
            .order_by(NotificationEmail.next_attempt_at, NotificationEmail.notification_id)
            .with_for_update(of=NotificationEmail, skip_locked=True).limit(1))).first()
        if row is None:
            return False
        queued, notification, user = row
        queued.attempts += 1
        try:
            content = await prepare_email(db, queued, notification, user)
            if content is None:
                # Terminally suppress stale reminders; never retry after return/extension.
                queued.failed = True
                logger.info('Notification email %s suppressed (stale reminder)', notification.id)
            else:
                await asyncio.to_thread(send_email, user.email, notification.title,
                                        content.text, notification.id,
                                        html=content.html, subject=content.subject)
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
