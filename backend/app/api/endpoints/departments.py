from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.db.database import get_db
from app.db.models import Department, RoleEnum, User
from app.schemas.department_lab import DepartmentCreate, DepartmentResponse
from app.api.deps import require_role

router = APIRouter()

@router.post("/", response_model=DepartmentResponse)
async def create_department(
    dept_in: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN))
):
    result = await db.execute(select(Department).where(Department.code == dept_in.code))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Department with this code already exists")
    
    dept = Department(**dept_in.model_dump())
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept

@router.get("/", response_model=List[DepartmentResponse])
async def list_departments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department))
    return result.scalars().all()
