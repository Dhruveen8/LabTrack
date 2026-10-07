"""Authorize the notification sender once using a local OAuth callback."""
import argparse
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import secrets
import time
from urllib.parse import parse_qs, urlencode, urlparse

import httpx
from dotenv import set_key

SCOPE = 'https://www.googleapis.com/auth/gmail.send'


def authorize(client, port):
    redirect = f'http://localhost:{port}/oauth/callback'
    if redirect not in client.get('redirect_uris', []):
        raise ValueError(f'Add {redirect} to the OAuth client authorized redirect URIs')
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    result = {}

    class Callback(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Callback URLs contain authorization codes; never log them.

        def do_GET(self):
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            valid = (parsed.path == '/oauth/callback'
                     and secrets.compare_digest(params.get('state', [''])[0], state))
            if not valid:
                self.send_error(400, 'Invalid OAuth callback')
                return
            result.update(code=params.get('code', [''])[0], error=params.get('error', [''])[0])
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(b'Authorization received. Return to the LabTrack terminal. You can close this tab.')

    with HTTPServer(('127.0.0.1', port), Callback) as server:
        server.timeout = 1
        url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode({
            'client_id': client['client_id'], 'redirect_uri': redirect,
            'response_type': 'code', 'scope': SCOPE, 'access_type': 'offline',
            'prompt': 'consent', 'state': state, 'code_challenge': challenge,
            'code_challenge_method': 'S256', 'login_hint': 'labtrack23@gmail.com',
        })
        print('Open this URL locally and sign in as labtrack23@gmail.com:\n' + url, flush=True)
        deadline = time.monotonic() + 300
        while not result and time.monotonic() < deadline:
            server.handle_request()
    if not result.get('code') or result.get('error'):
        raise ValueError('Authorization cancelled or timed out; no configuration changed')
    response = httpx.post('https://oauth2.googleapis.com/token', data={
        'client_id': client['client_id'], 'client_secret': client['client_secret'],
        'code': result['code'], 'code_verifier': verifier,
        'redirect_uri': redirect, 'grant_type': 'authorization_code',
    }, timeout=15)
    if response.status_code != 200:
        raise ValueError('Google token exchange failed; no configuration changed')
    token = response.json()
    if not token.get('refresh_token'):
        raise ValueError('Google did not issue a refresh token; authorize again with consent')
    if SCOPE not in token.get('scope', '').split():
        raise ValueError('Gmail send permission was not granted; no configuration changed')
    return token['refresh_token']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client-secrets', type=Path, required=True,
                        help='Downloaded Web application OAuth client JSON (keep private)')
    parser.add_argument('--env-file', type=Path, default=Path(__file__).parent / '.env')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    try:
        client = json.loads(args.client_secrets.read_text())['web']
        token = authorize(client, args.port)
        args.env_file.touch(exist_ok=True)
        for key, value in {
            'EMAIL_PROVIDER': 'gmail_api', 'GMAIL_ENABLED': 'true',
            'GMAIL_CLIENT_ID': client['client_id'], 'GMAIL_CLIENT_SECRET': client['client_secret'],
            'GMAIL_REFRESH_TOKEN': token, 'GMAIL_FROM_EMAIL': 'labtrack23@gmail.com',
        }.items():
            set_key(str(args.env_file), key, value)
        print('Gmail credentials saved to the backend environment file. Restart the backend.')
    except Exception as error:
        # HTTP errors and malformed credentials must never dump secret data.
        print(str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError)
              else f'Gmail setup failed ({type(error).__name__}); check the client file and connection')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
