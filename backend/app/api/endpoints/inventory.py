from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List

from app.db.database import get_db
from app.db.models import EquipmentModel, EquipmentUnit, Lab, Department, RoleEnum, User, UnitStatusEnum
from app.schemas.inventory import EquipmentModelCreate, EquipmentModelResponse, EquipmentUnitCreate, EquipmentUnitResponse
from app.api.deps import require_role, get_current_user

router = APIRouter()

@router.post("/models", response_model=EquipmentModelResponse)
async def create_equipment_model(
    model_in: EquipmentModelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN))
):
    lab_result = await db.execute(select(Lab).where(Lab.id == model_in.lab_id))
    if not lab_result.scalars().first():
        raise HTTPException(status_code=404, detail="Lab not found")
        
    eq_model = EquipmentModel(**model_in.model_dump())
    db.add(eq_model)
    await db.commit()
    await db.refresh(eq_model)
    return eq_model

@router.get("/models", response_model=List[EquipmentModelResponse])
async def list_equipment_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EquipmentModel))
    return result.scalars().all()

@router.post("/units", response_model=EquipmentUnitResponse)
async def create_equipment_unit(
    unit_in: EquipmentUnitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.ASSISTANT]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get model and associated lab/department
    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == unit_in.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")
        
    lab_result = await db.execute(select(Lab).where(Lab.id == eq_model.lab_id))
    lab = lab_result.scalars().first()
    
    dept_result = await db.execute(select(Department).where(Department.id == lab.department_id))
    dept = dept_result.scalars().first()

    # Generate asset ID LT-[LAB_CODE]-[CATEGORY_CODE]-[SEQUENCE]
    # For lab code, we can use lab name or department code. The requirements said LT-IOT-MC-00001
    lab_code = lab.name.split()[0].upper()[:4] # simplistic lab code generation
    cat_code = eq_model.category.upper()[:2]
    
    prefix = f"LT-{lab_code}-{cat_code}-"
    
    # Get max sequence for this prefix
    # In a real high-concurrency app, this needs a sequence or lock. We'll use string matching for now.
    stmt = select(func.max(EquipmentUnit.asset_id)).where(EquipmentUnit.asset_id.like(f"{prefix}%"))
    max_id_result = await db.execute(stmt)
    max_id = max_id_result.scalar()
    
    if max_id:
        seq_str = max_id.split("-")[-1]
        next_seq = int(seq_str) + 1
    else:
        next_seq = 1
        
    asset_id = f"{prefix}{next_seq:05d}"
    
    unit = EquipmentUnit(
        asset_id=asset_id,
        model_id=eq_model.id,
        serial_number=unit_in.serial_number,
        condition=unit_in.condition,
        status=UnitStatusEnum.AVAILABLE
    )
    
    eq_model.total_quantity += 1
    
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    return unit
