# Gmail API notifications

The configured sender is `labtrack23@gmail.com`. Gmail API sends through HTTPS, so it works on hosting services that block SMTP ports. OAuth client credentials and a refresh token stay in the backend environment; frontend code never receives them. A normal Gmail password or API key is not sufficient.

## One-time Google setup

1. In your [Google Cloud console](https://console.cloud.google.com/), create/select your project and enable **Gmail API** in APIs & Services.
2. Configure Google Auth Platform branding and audience. For a personal Gmail account select External. While testing, add `labtrack23@gmail.com` as a test user.
3. Under Data Access add only `https://www.googleapis.com/auth/gmail.send`.
4. Create an OAuth client of type **Web application**. Add this exact authorized redirect URI: `http://localhost:8765/oauth/callback`.
5. Download the OAuth client JSON. Keep it private; filenames beginning `client_secret` are excluded from Git and the backend Docker image.
6. From the backend directory run:

```powershell
./venv/Scripts/python.exe setup_gmail.py --client-secrets "C:/path/to/client_secret_download.json"
```

Open the URL printed by the script on this computer. Sign in as **labtrack23@gmail.com** and approve send permission. The local callback uses state validation and PKCE, exchanges the code for a refresh token, and saves credentials directly to `backend/.env` without printing them. The authorization window expires after five minutes. The script does not send a test email.

For Docker, add `--env-file ../.env` to save into the root environment file instead. If deploying later, copy these values privately into the backend host's secret/environment settings:

```dotenv
EMAIL_PROVIDER=gmail_api
GMAIL_ENABLED=true
GMAIL_FROM_EMAIL=labtrack23@gmail.com
GMAIL_FROM_NAME=LabTrack
GMAIL_CLIENT_ID=YOUR_OAUTH_CLIENT_ID
GMAIL_CLIENT_SECRET=YOUR_PRIVATE_CLIENT_SECRET
GMAIL_REFRESH_TOKEN=YOUR_PRIVATE_REFRESH_TOKEN
GMAIL_TIMEOUT_SECONDS=10
```

Do not paste the JSON, client secret or refresh token into chat or commit them. If the OAuth audience remains External/Testing, refresh tokens with Gmail permission expire after seven days. Move the OAuth app to Production and complete any Google requirements that apply before relying on ongoing delivery. Tokens can also be revoked and require reauthorization. See [Google OAuth token expiry](https://developers.google.com/identity/protocols/oauth2#expiration) and [Gmail send scope](https://developers.google.com/workspace/gmail/api/auth/scopes).

## Enable and verify

Run `./venv/Scripts/python.exe -m app.startup`, then restart the backend. Approve a real request and confirm the borrower receives the notification, including checking spam. This project cannot verify live delivery until you complete sender authorization. The sender account is addressed explicitly in the Gmail API request, so authorization for a different mailbox will fail.

Workflow notifications queue in the same database transaction as the notification. Workers refresh access tokens automatically, retry a stale access token once, and retry failed queued deliveries up to five times. Errors log notification IDs and exception types, not tokens, Google response bodies or recipient message content. Successful rows have `sent_at`; exhausted rows have `failed=true`. Disabled mail does not queue new deliveries. Previously existing notifications are not emailed retroactively.

Delivery is at least once: if Google accepts a message but the database commit fails, a retry can duplicate it. Workers use row locks and stable message IDs to reduce duplicates. Sleeping free hosts pause this worker. No daily overdue-reminder scheduler is added.

SMTP remains available as an alternative with `EMAIL_PROVIDER=smtp`, `SMTP_ENABLED=true` and the SMTP settings in `.env.example`. The Gmail API integration does not need a Gmail app password.

References: [Gmail messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server).
