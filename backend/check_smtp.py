"""Check Gmail TLS/authentication without sending email or printing credentials."""
import smtplib
import ssl
from app.core.config import settings


def main():
    if not settings.smtp_ready:
        print('SMTP configuration incomplete or disabled; set SMTP_USER and SMTP_PASSWORD in backend/.env.')
        return 1
    try:
        with smtplib.SMTP('smtp.gmail.com', 587, timeout=settings.SMTP_TIMEOUT_SECONDS) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD.get_secret_value().replace(' ', ''))
        print('Gmail SMTP connection, STARTTLS and authentication succeeded. No email sent.')
        return 0
    except Exception as error:
        print(f'Gmail SMTP check failed ({type(error).__name__}). No email sent.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
