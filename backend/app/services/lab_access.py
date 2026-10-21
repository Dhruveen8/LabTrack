"""Shared assistant lab scope query for inventory and borrowing operations."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LabAssistantAssignment, Lab, User, RoleEnum, AccountStatusEnum


async def get_assistant_labs(db: AsyncSession, assistant_id: int) -> list[int]:
    result = await db.execute(
        select(LabAssistantAssignment.lab_id)
        .join(Lab, Lab.id == LabAssistantAssignment.lab_id)
        .join(User, User.id == LabAssistantAssignment.assistant_id)
        .where(LabAssistantAssignment.assistant_id == assistant_id)
        .where(User.department_id == Lab.department_id, User.role == RoleEnum.ASSISTANT,
               User.account_status == AccountStatusEnum.ACTIVE)
    )
    return list(result.scalars().all())
