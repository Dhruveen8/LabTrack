"""Role-specific institutional identifiers and atomic assistant numbering."""
import re
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from app.db.models import AssetSequence, RoleEnum, User

PATTERNS = {RoleEnum.STUDENT: r'D?[0-9]{2}[A-Z]+[0-9]{3}', RoleEnum.FACULTY: r'F[A-Z]+[0-9]{3}'}


def institutional_id(role, value):
    value = (value or '').strip().upper()
    if role in PATTERNS and (len(value) > 32 or not re.fullmatch(PATTERNS[role], value)):
        example = '24CE069 or D25CE150 (D2D)' if role == RoleEnum.STUDENT else 'FCE001'
        raise ValueError(f'{role.value.capitalize()} ID must follow the format {example}')
    return value or None


async def next_assistant_number(db):
    maximum = (await db.execute(select(func.coalesce(func.max(User.assistant_number), 0)))).scalar_one()
    statement = insert(AssetSequence).values(prefix='assistant-display', last_value=maximum+1)
    statement = statement.on_conflict_do_update(index_elements=[AssetSequence.prefix],
        set_={'last_value': func.greatest(AssetSequence.last_value, maximum)+1}).returning(AssetSequence.last_value)
    number = (await db.execute(statement)).scalar_one()
    if number > 999:
        raise ValueError('All 999 assistant identifiers have been allocated')
    return number
