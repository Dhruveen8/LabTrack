from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.db.database import get_db
from app.db.models import Department, RoleEnum, User
from app.schemas.department_lab import DepartmentCreate, DepartmentResponse
from app.api.deps import require_role, get_current_user, require_admin

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

# --- SEC-2: Require authentication to list departments ---
@router.get("/", response_model=List[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Department))
    return result.scalars().all()

# --- BE-3a: Department CRUD ---
@router.get("/{dept_id}", response_model=DepartmentResponse)
async def get_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept

@router.put("/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: int,
    dept_in: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    update_data = dept_in.model_dump()
    for field, value in update_data.items():
        setattr(dept, field, value)
    
    await db.commit()
    await db.refresh(dept)
    return dept

@router.delete("/{dept_id}")
async def delete_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    await db.delete(dept)
    await db.commit()
    return {"message": "Department deleted successfully"}
