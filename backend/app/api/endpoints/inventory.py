from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List

from app.db.database import get_db
from app.db.models import EquipmentModel, EquipmentUnit, Lab, Department, RoleEnum, User, UnitStatusEnum, Transaction, TransactionStatusEnum
from app.schemas.inventory import (
    EquipmentModelCreate, EquipmentModelResponse, EquipmentModelUpdate,
    EquipmentUnitCreate, EquipmentUnitResponse, BulkUnitCreate, UnitStatusUpdate
)
from app.api.deps import require_role, get_current_user, require_admin

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

# --- SEC-2: Require authentication to list models ---
@router.get("/models", response_model=List[EquipmentModelResponse])
async def list_equipment_models(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(EquipmentModel))
    return result.scalars().all()

# --- BE-3c: Equipment Model CRUD ---
@router.put("/models/{model_id}", response_model=EquipmentModelResponse)
async def update_equipment_model(
    model_id: int,
    model_update: EquipmentModelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == model_id))
    eq_model = result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")
    
    update_data = model_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(eq_model, field, value)
    
    await db.commit()
    await db.refresh(eq_model)
    return eq_model

@router.delete("/models/{model_id}")
async def delete_equipment_model(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == model_id))
    eq_model = result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")
    
    # Check no active transactions exist for units of this model
    active_check = await db.execute(
        select(Transaction)
        .join(EquipmentUnit, Transaction.unit_asset_id == EquipmentUnit.asset_id)
        .where(EquipmentUnit.model_id == model_id)
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )
    if active_check.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete model with active transactions")
    
    # Delete all units first, then the model
    units_result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.model_id == model_id))
    for unit in units_result.scalars().all():
        await db.delete(unit)
    
    await db.delete(eq_model)
    await db.commit()
    return {"message": "Equipment model and its units deleted successfully"}

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

    # Phase 7.2: Use Lab code for asset IDs to avoid collisions
    lab_code = (lab.code or lab.name.split()[0][:4]).upper()
    cat_code = eq_model.category.upper()[:2]
    
    prefix = f"LT-{lab_code}-{cat_code}-"
    
    # --- BE-7: Use FOR UPDATE to prevent race condition ---
    stmt = (
        select(func.max(EquipmentUnit.asset_id))
        .where(EquipmentUnit.asset_id.like(f"{prefix}%"))
        .with_for_update()
    )
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

# --- SEC-2: Require authentication to list units ---
@router.get("/units", response_model=List[EquipmentUnitResponse])
async def list_equipment_units(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(EquipmentUnit))
    return result.scalars().all()

@router.get("/units/{asset_id}", response_model=EquipmentUnitResponse)
async def get_equipment_unit(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == asset_id))
    unit = result.scalars().first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit

# --- BE-3c: PATCH unit status/condition ---
@router.patch("/units/{asset_id}/status", response_model=EquipmentUnitResponse)
async def update_unit_status(
    asset_id: str,
    status_update: UnitStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.ASSISTANT]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.execute(select(EquipmentUnit).where(EquipmentUnit.asset_id == asset_id))
    unit = result.scalars().first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    if status_update.status is not None:
        unit.status = status_update.status
    if status_update.condition is not None:
        unit.condition = status_update.condition
    
    await db.commit()
    await db.refresh(unit)
    return unit

# --- Bulk unit creation ---
@router.post("/units/bulk", response_model=List[EquipmentUnitResponse])
async def bulk_create_units(
    bulk_in: BulkUnitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.ASSISTANT]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == bulk_in.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")
    
    lab_result = await db.execute(select(Lab).where(Lab.id == eq_model.lab_id))
    lab = lab_result.scalars().first()
    
    lab_code = (lab.code or lab.name.split()[0][:4]).upper()
    cat_code = eq_model.category.upper()[:2]
    prefix = f"LT-{lab_code}-{cat_code}-"
    
    # Get max sequence with lock
    stmt = (
        select(func.max(EquipmentUnit.asset_id))
        .where(EquipmentUnit.asset_id.like(f"{prefix}%"))
        .with_for_update()
    )
    max_id_result = await db.execute(stmt)
    max_id = max_id_result.scalar()
    
    if max_id:
        next_seq = int(max_id.split("-")[-1]) + 1
    else:
        next_seq = 1
    
    created_units = []
    for i in range(bulk_in.quantity):
        asset_id = f"{prefix}{next_seq + i:05d}"
        unit = EquipmentUnit(
            asset_id=asset_id,
            model_id=eq_model.id,
            serial_number=None,
            condition="New",
            status=UnitStatusEnum.AVAILABLE
        )
        db.add(unit)
        created_units.append(unit)
    
    eq_model.total_quantity += bulk_in.quantity
    
    await db.commit()
    for unit in created_units:
        await db.refresh(unit)
    return created_units

# --- Stats endpoint ---
@router.get("/stats")
async def get_inventory_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    units_result = await db.execute(select(EquipmentUnit))
    units = units_result.scalars().all()
    
    available = sum(1 for u in units if u.status == UnitStatusEnum.AVAILABLE)
    issued = sum(1 for u in units if u.status == UnitStatusEnum.ISSUED)
    maintenance = sum(1 for u in units if u.status == UnitStatusEnum.MAINTENANCE)
    
    models_result = await db.execute(select(func.count(EquipmentModel.id)))
    total_models = models_result.scalar()
    
    return {
        "totalEquipment": len(units),
        "totalModels": total_models,
        "available": available,
        "borrowed": issued,
        "maintenance": maintenance
    }
