"""Create a private PostgreSQL archive and verify a complete disposable restore."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone
import uuid

import psycopg2
from psycopg2 import sql
from sqlalchemy.engine import make_url
from app.core.config import settings


def backup():
    url = make_url(settings.SQLALCHEMY_DATABASE_URI)
    tools = Path(r'C:\Program Files\PostgreSQL\18\bin')
    output = Path(__file__).resolve().parents[1] / 'output' / 'private-backups'
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'labtrack-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.dump'
    env = {**os.environ, 'PGPASSWORD': url.password or ''}
    connection = dict(host=url.host, port=url.port or 5432, user=url.username, password=url.password)
    common = ['-h', url.host, '-p', str(url.port or 5432), '-U', url.username]
    subprocess.run([str(tools / 'pg_dump.exe'), *common, '-Fc', '--no-owner', '-f', str(archive), url.database], env=env, check=True, capture_output=True)
    temporary = 'labtrack_backup_verify_' + uuid.uuid4().hex[:12]
    admin = psycopg2.connect(**connection, dbname='postgres')
    admin.autocommit = True
    try:
        with admin.cursor() as cursor:
            cursor.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(temporary)))
        subprocess.run([str(tools / 'pg_restore.exe'), *common, '--no-owner', '--exit-on-error', '-d', temporary, str(archive)], env=env, check=True, capture_output=True)
        with psycopg2.connect(**connection, dbname=temporary) as restored:
            with restored.cursor() as cursor:
                cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
                counts = {}
                for (table,) in cursor.fetchall():
                    cursor.execute(sql.SQL('SELECT count(*) FROM {}').format(sql.Identifier(table)))
                    counts[table] = cursor.fetchone()[0]
        manifest = {'archive': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                    'restore_verified': True, 'restored_table_counts': counts}
        archive.with_suffix('.json').write_text(json.dumps(manifest, indent=2))
        print(f'Backup restored successfully: {archive}')
        print(f'Verified {len(counts)} tables.')
        return archive
    finally:
        with admin.cursor() as cursor:
            cursor.execute(sql.SQL('DROP DATABASE IF EXISTS {} WITH (FORCE)').format(sql.Identifier(temporary)))
        admin.close()


if __name__ == '__main__':
    backup()
