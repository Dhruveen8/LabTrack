"""OAuth and Gmail HTTP regressions. No Google requests or real emails."""
import base64
from email import policy
from email.parser import BytesParser
from email.message import EmailMessage

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings, settings
from app.services import gmail_api
from app.services.email_notifications import send_email


@pytest.fixture
def gmail(monkeypatch):
    for key, value in {
        'EMAIL_PROVIDER': 'gmail_api', 'GMAIL_ENABLED': True,
        'GMAIL_CLIENT_ID': 'test-client', 'GMAIL_CLIENT_SECRET': SecretStr('test-secret'),
        'GMAIL_REFRESH_TOKEN': SecretStr('test-refresh'),
        'GMAIL_FROM_EMAIL': 'labtrack23@gmail.com',
    }.items():
        monkeypatch.setattr(settings, key, value)
    return gmail_api.GmailSender()


def mock_transport(monkeypatch, handler):
    original = httpx.Client
    monkeypatch.setattr(gmail_api.httpx, 'Client',
                        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))


def test_refresh_send_and_cached_token(gmail, monkeypatch):
    requests = []
    def handler(request):
        requests.append(request)
        if request.url.host == 'oauth2.googleapis.com':
            assert b'grant_type=refresh_token' in request.content
            assert b'test-refresh' in request.content
            return httpx.Response(200, json={'access_token': 'access', 'expires_in': 3600})
        assert request.headers['Authorization'] == 'Bearer access'
        return httpx.Response(200, json={'id': 'sent'})
    mock_transport(monkeypatch, handler)
    monkeypatch.setattr('app.services.email_notifications.gmail_sender', gmail)
    send_email('recipient@example.test', 'Approved', 'Due 07-10-2026', 123)
    send_email('recipient@example.test', 'Returned', 'Thank you', 124)
    assert sum(r.url.host == 'oauth2.googleapis.com' for r in requests) == 1
    import json
    raw = json.loads(requests[1].content)['raw']
    message = BytesParser(policy=policy.default).parsebytes(base64.urlsafe_b64decode(raw))
    assert message['To'] == 'recipient@example.test'
    assert 'labtrack23@gmail.com' in message['From']
    assert message['Message-ID'] == '<labtrack-notification-123@gmail.com>'
    assert 'Due 07-10-2026' in message.get_content()
    assert requests[1].url.path == '/gmail/v1/users/labtrack23@gmail.com/messages/send'


def test_unauthorized_token_refreshed_once(gmail, monkeypatch):
    count = {'refresh': 0, 'send': 0}
    def handler(request):
        if request.url.host == 'oauth2.googleapis.com':
            count['refresh'] += 1
            return httpx.Response(200, json={'access_token': 'access'+str(count['refresh'])})
        count['send'] += 1
        return httpx.Response(401 if count['send'] == 1 else 200, json={'id': 'sent'})
    mock_transport(monkeypatch, handler)
    gmail.send(EmailMessage())
    assert count == {'refresh': 2, 'send': 2}


@pytest.mark.parametrize('status', [400, 401, 403, 429, 500])
def test_refresh_error_does_not_expose_credentials(gmail, monkeypatch, status):
    mock_transport(monkeypatch, lambda request: httpx.Response(status, text='test-secret test-refresh'))
    with pytest.raises(gmail_api.GmailDeliveryError) as error:
        gmail.send(EmailMessage())
    assert 'test-secret' not in str(error.value) and 'test-refresh' not in str(error.value)


@pytest.mark.parametrize('status', [400, 401, 403, 429, 500])
def test_send_failure_is_not_marked_delivered(gmail, monkeypatch, status):
    requests = []
    def handler(request):
        requests.append(request)
        if request.url.host == 'oauth2.googleapis.com':
            return httpx.Response(200, json={'access_token': 'access'})
        return httpx.Response(status, text='Private Google response')
    mock_transport(monkeypatch, handler)
    with pytest.raises(gmail_api.GmailDeliveryError) as error:
        gmail.send(EmailMessage())
    assert 'Private Google response' not in str(error.value)
    assert len(requests) == (4 if status == 401 else 2)


def test_token_expiry_and_changed_credentials_refresh(gmail, monkeypatch):
    refresh = []
    def handler(request):
        if request.url.host == 'oauth2.googleapis.com':
            refresh.append(request)
            return httpx.Response(200, json={'access_token': 'access', 'expires_in': 3600})
        return httpx.Response(200, json={'id': 'sent'})
    mock_transport(monkeypatch, handler)
    gmail.send(EmailMessage())
    gmail._expires_at = 0
    gmail.send(EmailMessage())
    monkeypatch.setattr(settings, 'GMAIL_REFRESH_TOKEN', SecretStr('new-refresh'))
    gmail.send(EmailMessage())
    assert len(refresh) == 3 and b'new-refresh' in refresh[-1].content


def test_missing_send_id_rejected(gmail, monkeypatch):
    mock_transport(monkeypatch, lambda request: httpx.Response(200, json={'access_token': 'access'}))
    with pytest.raises(gmail_api.GmailDeliveryError):
        gmail.send(EmailMessage())


def test_missing_refresh_token_config_is_not_ready(gmail, monkeypatch):
    assert settings.email_ready
    monkeypatch.setattr(settings, 'GMAIL_REFRESH_TOKEN', SecretStr(''))
    assert settings.email_enabled and not settings.email_ready


def test_mail_disabled_by_default():
    config = Settings(_env_file=None, SECRET_KEY='test')
    assert not config.email_enabled and not config.email_ready


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
