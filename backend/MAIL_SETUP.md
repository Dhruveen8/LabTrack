# Gmail SMTP notifications

1. Enable 2-Step Verification on the sender Google account and create a Google App Password at https://myaccount.google.com/apppasswords.
2. Add the following to `backend/.env`. Use the full Gmail address and the App Password, never the normal account password. Keep this file private and out of Git.

```dotenv
SMTP_ENABLED=true
SMTP_USER=your-account@gmail.com
SMTP_PASSWORD=YOUR_GOOGLE_APP_PASSWORD
SMTP_FROM_NAME=LabTrack
SMTP_TIMEOUT_SECONDS=10
```

The service loads `backend/.env` independently of the working directory. Environment variables take precedence. Docker loads root `.env` then `backend/.env`; keep database settings consistent. Remove obsolete EMAIL_PROVIDER and GMAIL_* OAuth settings from deployment secrets manually. No OAuth setup or new dependency is needed; httpx remains used by API tests.

Restart the backend after changing credentials. Delivery uses Python smtplib, smtp.gmail.com port 587 and verified STARTTLS. The hosting network must allow outbound TCP 587. App Password availability depends on Google account policy.

Check connectivity without sending mail:

```powershell
cd backend
./.venv/Scripts/python.exe check_smtp.py
```

This verifies connection, TLS and authentication, and prints no credentials or server responses. It does not send email. Then log in, issue equipment, return it, and verify the borrower inbox and portal notifications. Run unit regressions with `./.venv/Scripts/python.exe -m pytest tests`.

Portal notification titles and bodies remain intact. The four primary email flows use branded HTML plus a plain-text fallback and their dedicated subjects: New Login to LabTrack; Equipment Issued Successfully – LabTrack; Reminder: Equipment Return Due Soon – LabTrack; Overdue Equipment Return – LabTrack. Dates are displayed in IST (UTC+05:30). Login notifications and a minute-based loan reminder scheduler fill missing flows in this checkout. Active loans get a reminder when they enter the final 24 hours and one overdue notification per deadline. The scheduler catches up after downtime; a loan already overdue gets only the overdue notification. Returned loans are excluded. Deadline extensions allow a new reminder for the new deadline.

Notifications and the existing outbox persist together. Loan locks and persisted title/body checks prevent duplicate reminder queueing across restarts and workers. Do not delete reminder notification records if deduplication must be retained. SMTP runs in the background and failures never propagate into authentication, issuance or returns. Failures log only IDs and exception types; retries are bounded to five attempts. Inspect notification_emails.sent_at, attempts and failed for delivery status. Disabled mail queues no new emails and existing portal notifications are not retroactively emailed.

SMTP delivery is at least once: acceptance followed by a failed database commit can cause a duplicate delivery. Stable Message-ID and row locks reduce duplicates but cannot guarantee exactly-once delivery through SMTP. The HTML templates require migration h2c7d9e6f4a5, which adds only nullable notification_emails.email_context. Existing records are preserved. This stores template kind, exact transaction IDs, and the reminder deadline, without copying user credentials or personal/equipment details. New issuance emails resolve each transaction to its unit and that unit’s model; event batches include all units. Pre-upgrade issuance notifications retain their generic content because they have no unambiguous transaction references. Existing login and loan-ID reminder notifications can use the new templates. Stale reminders (returned loan, changed deadline, expired upcoming stage) are terminally suppressed with failed=true and an informational log rather than sent.


## Apply the template migration

From the backend directory, with the backend stopped:

```powershell
./.venv/Scripts/python.exe -m alembic upgrade head
```

Then restart the backend normally. Do not change SMTP credentials if already configured. Startup via app.startup or Docker applies migrations automatically. The migration has already been applied to the current local database; other installations must apply it before running this version.

## Verify templates without sending mail

```powershell
./.venv/Scripts/python.exe -m pytest tests
# Optional real PostgreSQL relationship and event issuance checks:
$env:LABTRACK_EMAIL_DB_TEST="1"
$env:LABTRACK_EVENT_DB_TEST="1"
./.venv/Scripts/python.exe -m pytest tests
```

The integration checks roll back all test records and do not run the email worker. SMTP is mocked in delivery tests. Live inbox rendering still needs verification through normal application actions after restart. Failures retain existing retry behavior and never log SMTP responses or message content.
