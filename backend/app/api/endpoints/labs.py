from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any

from app.db.database import get_db
from app.db.models import Lab, Department, RoleEnum, User, LabAssistantAssignment
from app.schemas.department_lab import LabCreate, LabResponse
from app.api.deps import require_role, get_current_user, require_admin

router = APIRouter()

@router.post("/", response_model=LabResponse)
async def create_lab(
    lab_in: LabCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN))
):
    # Verify department exists
    dept_result = await db.execute(select(Department).where(Department.id == lab_in.department_id))
    if not dept_result.scalars().first():
        raise HTTPException(status_code=404, detail="Department not found")

    lab = Lab(**lab_in.model_dump())
    db.add(lab)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail='Lab code already exists')
    await db.refresh(lab)
    return lab

# --- SEC-2: Require authentication to list labs ---
@router.get("/", response_model=List[LabResponse])
async def list_labs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Lab))
    return result.scalars().all()

@router.get("/assignments", response_model=List[Dict[str, Any]])
async def list_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(LabAssistantAssignment))
    assignments = result.scalars().all()
    return [{"lab_id": a.lab_id, "assistant_id": a.assistant_id} for a in assignments]

# --- BE-3b: Lab CRUD ---
@router.get("/{lab_id}", response_model=LabResponse)
async def get_lab(
    lab_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Lab).where(Lab.id == lab_id))
    lab = result.scalars().first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")
    return lab

@router.put("/{lab_id}", response_model=LabResponse)
async def update_lab(
    lab_id: int,
    lab_in: LabCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(Lab).where(Lab.id == lab_id))
    lab = result.scalars().first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    update_data = lab_in.model_dump()
    if not await db.get(Department, lab_in.department_id):
        raise HTTPException(status_code=404, detail='Department not found')
    for field, value in update_data.items():
        setattr(lab, field, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail='Lab code already exists')
    await db.refresh(lab)
    return lab

@router.delete("/{lab_id}")
async def delete_lab(
    lab_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(Lab).where(Lab.id == lab_id))
    lab = result.scalars().first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    await db.delete(lab)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail='Cannot delete a lab with equipment or borrowing history')
    return {"message": "Lab deleted successfully"}

@router.post("/{lab_id}/assign_assistant")
async def assign_assistant(
    lab_id: int,
    assistant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN))
):
    lab_result = await db.execute(select(Lab).where(Lab.id == lab_id))
    lab = lab_result.scalars().first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    user_result = await db.execute(select(User).where(User.id == assistant_id))
    assistant = user_result.scalars().first()
    if not assistant or assistant.role != RoleEnum.ASSISTANT:
        raise HTTPException(status_code=400, detail="User is not a valid assistant")

    # FIX: Upsert by lab_id alone — if any assignment exists for this lab,
    # update it to the new assistant (replacing the previous one).
    existing_res = await db.execute(
        select(LabAssistantAssignment)
        .where(LabAssistantAssignment.lab_id == lab_id)
    )
    existing = existing_res.scalars().first()
    if existing:
        existing.assistant_id = assistant.id
        existing.assigned_by_id = current_user.id
    else:
        db.add(LabAssistantAssignment(
            lab_id=lab_id,
            assistant_id=assistant.id,
            assigned_by_id=current_user.id
        ))

    await db.commit()
    return {"message": "Assistant assigned successfully", "lab_id": lab_id, "assistant_id": assistant.id}
