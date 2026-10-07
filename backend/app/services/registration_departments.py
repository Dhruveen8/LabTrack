"""Departments currently offered during self-registration."""
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import text
from app.db.models import Department

REGISTRATION_DEPARTMENTS = {
    'CE': 'Computer Engineering',
    'CSE': 'Computer Science Engineering',
    'IT': 'Information Technology',
    'AIML': 'Artificial Intelligence and Machine Learning',
    'EC': 'Electronics and Communication',
}


async def ensure_registration_departments(db):
    await db.execute(text('SELECT pg_advisory_xact_lock(48290125)'))
    for code, name in REGISTRATION_DEPARTMENTS.items():
        await db.execute(insert(Department).values(code=code, name=name)
                         .on_conflict_do_update(index_elements=[Department.code], set_={'name': name}))
