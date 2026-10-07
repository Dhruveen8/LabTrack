"""Gmail's HTTPS send endpoint with server-side OAuth refresh credentials."""
import base64
import threading
import time
from email.policy import SMTP
from urllib.parse import quote

import httpx
from app.core.config import settings


class GmailDeliveryError(RuntimeError):
    """Safe to log: never includes a Google response or credential."""


class GmailSender:
    def __init__(self):
        self._lock = threading.Lock()
        self._token = ''
        self._expires_at = 0
        self._credentials = None

    def _access_token(self, client, credentials):
        if self._credentials != credentials or time.monotonic() >= self._expires_at:
            response = client.post('https://oauth2.googleapis.com/token', data={
                'client_id': credentials[0], 'client_secret': credentials[1],
                'refresh_token': credentials[2], 'grant_type': 'refresh_token',
            })
            if response.status_code != 200:
                raise GmailDeliveryError('Gmail OAuth refresh failed; check sender authorization')
            data = response.json()
            if not data.get('access_token'):
                raise GmailDeliveryError('Gmail OAuth response omitted access token')
            self._token = data['access_token']
            self._expires_at = time.monotonic() + max(0, int(data.get('expires_in', 3600)) - 60)
            self._credentials = credentials
        return self._token

    def send(self, message):
        credentials = (settings.GMAIL_CLIENT_ID, settings.GMAIL_CLIENT_SECRET.get_secret_value(),
                       settings.GMAIL_REFRESH_TOKEN.get_secret_value())
        # Protect token refresh/cache when the sender is used from multiple threads.
        with self._lock, httpx.Client(timeout=settings.GMAIL_TIMEOUT_SECONDS, follow_redirects=False) as client:
            payload = {'raw': base64.urlsafe_b64encode(message.as_bytes(policy=SMTP)).decode('ascii')}
            for attempt in range(2):
                token = self._access_token(client, credentials)
                sender = quote(settings.GMAIL_FROM_EMAIL, safe='')
                response = client.post(f'https://gmail.googleapis.com/gmail/v1/users/{sender}/messages/send',
                                       headers={'Authorization': f'Bearer {token}'}, json=payload)
                if response.status_code == 401 and attempt == 0:
                    self._expires_at = 0
                    continue
                if response.status_code != 200 or not response.json().get('id'):
                    raise GmailDeliveryError('Gmail rejected notification delivery')
                return


gmail_sender = GmailSender()
