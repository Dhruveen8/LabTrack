"""Shared assistant lab scope query for inventory and borrowing operations."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LabAssistantAssignment


async def get_assistant_labs(db: AsyncSession, assistant_id: int) -> list[int]:
    result = await db.execute(
        select(LabAssistantAssignment.lab_id)
        .where(LabAssistantAssignment.assistant_id == assistant_id)
    )
    return list(result.scalars().all())
