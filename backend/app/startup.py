"""Wait, migrate and optionally bootstrap an admin without loading demo data."""
import asyncio
import logging
import subprocess
import sys
from pathlib import Path

from email_validator import validate_email
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.database import AsyncSessionLocal, engine
from app.db.models import AccountStatusEnum, RoleEnum, SystemSetting, User
from app.services.registration_departments import ensure_registration_departments

logger = logging.getLogger(__name__)
DEFAULT_SETTINGS = {
    'STUDENT_MAX_BORROW_DAYS': '14', 'FACULTY_MAX_BORROW_DAYS': '30',
    'STUDENT_MAX_ITEMS': '3', 'ALLOW_SELF_RENEWAL': 'true',
    'EMAIL_OVERDUE_ALERTS': 'true', 'TRANSFER_ALERTS': 'true',
}


async def bootstrap(db):
    await db.execute(text('SELECT pg_advisory_xact_lock(48290123)'))
    await ensure_registration_departments(db)
    for key, value in DEFAULT_SETTINGS.items():
        await db.execute(insert(SystemSetting).values(key=key, value=value)
                         .on_conflict_do_nothing(index_elements=[SystemSetting.key]))
    if (await db.execute(select(User.id).where(User.role == RoleEnum.ADMIN))).first():
        return False
    email = settings.BOOTSTRAP_ADMIN_EMAIL.strip().lower()
    password = settings.BOOTSTRAP_ADMIN_PASSWORD.get_secret_value()
    if not email and not password:
        logger.info('No admin configured. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create one.')
        return False
    if not email or len(password) < 12:
        raise ValueError('Bootstrap requires an admin email and a password of at least 12 characters')
    validate_email(email, check_deliverability=False)
    if (await db.execute(select(User.id).where(User.email == email))).first():
        raise ValueError('Bootstrap email belongs to an existing non-admin user')
    db.add(User(name=settings.BOOTSTRAP_ADMIN_NAME, email=email, role=RoleEnum.ADMIN,
                account_status=AccountStatusEnum.ACTIVE, hashed_password=get_password_hash(password)))
    await db.flush()
    logger.info('Initial admin created')
    return True


async def wait_for_database():
    for attempt in range(max(1, settings.DB_STARTUP_ATTEMPTS)):
        try:
            async def probe():
                async with engine.connect() as connection:
                    await connection.execute(text('SELECT 1'))
            await asyncio.wait_for(probe(), timeout=5)
            return
        except Exception:
            if attempt + 1 >= max(1, settings.DB_STARTUP_ATTEMPTS):
                raise RuntimeError('Database unavailable; check connection settings and credentials') from None
            logger.info('Waiting for database (%s)', attempt + 1)
            await asyncio.sleep(2)


async def prepare_database():
    await wait_for_database()
    # Serialize migrations across simultaneous container starts.
    async with engine.connect() as lock:
        await lock.execute(text('SELECT pg_advisory_lock(48290124)'))
        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable, '-m', 'alembic', 'upgrade', 'head',
                cwd=Path(__file__).resolve().parents[1],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            await process.communicate()
            if process.returncode:
                raise RuntimeError('Database migrations failed; run alembic upgrade head locally for diagnostics')
            logger.info('Database migrations applied')
            async with AsyncSessionLocal() as db:
                await bootstrap(db)
                await db.commit()
        finally:
            await lock.rollback()
            await lock.execute(text('SELECT pg_advisory_unlock(48290124)'))
            await lock.commit()


def main():
    logging.basicConfig(level=logging.INFO)
    async def run():
        try:
            await prepare_database()
        finally:
            await engine.dispose()
    try:
        asyncio.run(run())
    except Exception as error:
        logger.error('Startup failed (%s): %s', type(error).__name__,
                     str(error) if isinstance(error, (ValueError, RuntimeError)) else 'Check configuration')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
