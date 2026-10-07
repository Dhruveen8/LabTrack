from app.services.lab_access import get_assistant_labs
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import List
import hashlib
import json
from app.services.asset_ids import reserve_asset_ids

from app.db.database import get_db
from app.db.models import (
    EquipmentModel,
    EquipmentUnit,
    Lab,
    RoleEnum,
    User,
    UnitStatusEnum,
    Transaction,
    TransactionStatusEnum,
    LabAssistantAssignment,
    InventoryImportBatch,
)
from app.schemas.inventory import (
    EquipmentModelCreate,
    EquipmentModelResponse,
    EquipmentModelUpdate,
    EquipmentUnitCreate,
    EquipmentUnitResponse,
    BulkUnitCreate,
    UnitStatusUpdate,
    BulkExcelImportRequest,
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

@router.get("/models", response_model=List[EquipmentModelResponse])
async def list_equipment_models(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all equipment models, with real unit counts computed per model."""
    models_result = await db.execute(select(EquipmentModel))
    models = models_result.scalars().all()

    # FIX: Compute real unit counts in one grouped query
    counts_result = await db.execute(
        select(EquipmentUnit.model_id, func.count(EquipmentUnit.asset_id))
        .group_by(EquipmentUnit.model_id)
    )
    unit_counts = {row[0]: row[1] for row in counts_result}

    available_counts_result = await db.execute(
        select(EquipmentUnit.model_id, func.count(EquipmentUnit.asset_id))
        .where(EquipmentUnit.status == UnitStatusEnum.AVAILABLE)
        .group_by(EquipmentUnit.model_id)
    )
    available_counts = {row[0]: row[1] for row in available_counts_result}

    response = []
    for m in models:
        response.append(EquipmentModelResponse(
            id=m.id,
            name=m.name,
            category=m.category,
            description=m.description,
            lab_id=m.lab_id,
            equipment_type=m.equipment_type,
            total_quantity=unit_counts.get(m.id, 0),
            available_quantity=available_counts.get(m.id, 0)
        ))
    return response

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
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail='Cannot delete equipment with borrowing or transfer history')
    return {"message": "Equipment model and its units deleted successfully"}

@router.post("/units", response_model=EquipmentUnitResponse)
async def create_equipment_unit(
    unit_in: EquipmentUnitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.ASSISTANT]:
        raise HTTPException(status_code=403, detail="Not authorized")

    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == unit_in.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")

    # FIX: Assistants can only add units to models in their assigned labs
    if current_user.role == RoleEnum.ASSISTANT:
        lab_ids = await get_assistant_labs(db, current_user.id)
        if eq_model.lab_id not in lab_ids:
            raise HTTPException(
                status_code=403,
                detail="You are not assigned to the lab that owns this equipment model"
            )

    lab_result = await db.execute(select(Lab).where(Lab.id == eq_model.lab_id))
    lab = lab_result.scalars().first()

    asset_id = (await reserve_asset_ids(db, lab.code, eq_model.category, 1))[0]

    unit = EquipmentUnit(
        asset_id=asset_id,
        model_id=eq_model.id,
        lab_id=eq_model.lab_id,
        serial_number=unit_in.serial_number,
        condition=unit_in.condition,
        status=UnitStatusEnum.AVAILABLE
    )

    db.add(unit)
    try:
        await db.commit()
        await db.refresh(unit)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create unit, possibly a concurrent ID conflict. Please retry.")
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

    # FIX: Assistants can only edit units in their assigned labs
    if current_user.role == RoleEnum.ASSISTANT:
        lab_ids = await get_assistant_labs(db, current_user.id)
        if unit.lab_id not in lab_ids:
            raise HTTPException(status_code=403, detail="Not authorized for this lab")

    # FIX: Prevent manually setting AVAILABLE on a currently loaned unit
    if status_update.status == UnitStatusEnum.AVAILABLE:
        active_tx_res = await db.execute(
            select(Transaction)
            .where(Transaction.unit_asset_id == asset_id)
            .where(Transaction.status == TransactionStatusEnum.ACTIVE)
        )
        if active_tx_res.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="Cannot manually set unit to AVAILABLE: it has an active loan transaction. Return the equipment through the proper return workflow."
            )

    if status_update.status is not None:
        unit.status = status_update.status
    if status_update.condition is not None:
        unit.condition = status_update.condition

    await db.commit()
    await db.refresh(unit)
    return unit

@router.post("/units/bulk", response_model=List[EquipmentUnitResponse])
async def bulk_create_units(
    bulk_in: BulkUnitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.ASSISTANT]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if bulk_in.quantity < 1:
        raise HTTPException(status_code=400, detail="quantity must be at least 1")

    model_result = await db.execute(select(EquipmentModel).where(EquipmentModel.id == bulk_in.model_id))
    eq_model = model_result.scalars().first()
    if not eq_model:
        raise HTTPException(status_code=404, detail="Equipment model not found")

    # FIX: Assistants can only create units for their assigned labs
    if current_user.role == RoleEnum.ASSISTANT:
        lab_ids = await get_assistant_labs(db, current_user.id)
        if eq_model.lab_id not in lab_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to the lab that owns this equipment model")

    lab_result = await db.execute(select(Lab).where(Lab.id == eq_model.lab_id))
    lab = lab_result.scalars().first()

    asset_ids = await reserve_asset_ids(db, lab.code, eq_model.category, bulk_in.quantity)
    created_units = []
    for asset_id in asset_ids:
        unit = EquipmentUnit(
            asset_id=asset_id,
            model_id=eq_model.id,
            lab_id=eq_model.lab_id,
            serial_number=None,
            condition="New",
            status=UnitStatusEnum.AVAILABLE
        )
        db.add(unit)
        created_units.append(unit)

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create units, possible concurrent ID conflict. Please retry.")
    for unit in created_units:
        await db.refresh(unit)
    return created_units

# --- Excel Bulk Import ---
@router.post("/import_excel")
async def import_excel_equipment(
    import_data: BulkExcelImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.ASSISTANT]:
        raise HTTPException(status_code=403, detail="Not authorized")

    lab_id = None
    if import_data.lab_id:
        # FIX: Honor the lab_id from the request body if provided
        lab_id = import_data.lab_id
    elif current_user.role == RoleEnum.ASSISTANT:
        from app.db.models import LabAssistantAssignment
        assign_res = await db.execute(
            select(LabAssistantAssignment.lab_id).where(LabAssistantAssignment.assistant_id == current_user.id)
        )
        labs_assigned = assign_res.scalars().all()
        if not labs_assigned:
            raise HTTPException(status_code=403, detail="Assistant is not assigned to any lab.")
        lab_id = int(labs_assigned[0])
    else:  # ADMIN without a specified lab_id
        raise HTTPException(status_code=400, detail="Admin must specify a target lab_id in the import request.")

    # Verify lab
    lab_result = await db.execute(select(Lab).where(Lab.id == lab_id))
    lab = lab_result.scalars().first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    if current_user.role == RoleEnum.ASSISTANT:
        if lab_id not in await get_assistant_labs(db, current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized to import into this lab")

    # Canonical row order makes re-uploading the same sheet a safe retry.
    rows = [item.model_dump() for item in import_data.items]
    canonical = sorted(json.dumps(row, sort_keys=True, separators=(",", ":")) for row in rows)
    content_hash = hashlib.sha256(json.dumps(canonical).encode()).hexdigest()
    batch = InventoryImportBatch(lab_id=lab_id, content_hash=content_hash)
    db.add(batch)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        existing = (await db.execute(select(InventoryImportBatch).where(
            InventoryImportBatch.lab_id == lab_id,
            InventoryImportBatch.content_hash == content_hash,
        ))).scalar_one_or_none()
        if existing is None or existing.result is None:
            raise HTTPException(status_code=409, detail="Import is still being processed; retry shortly")
        return {**existing.result, "alreadyImported": True, "modelsCreated": 0, "unitsCreated": 0}

    created_units = []
    try:
        # Reserve prefixes in a consistent order to avoid opposing lock orders
        # when two different batches contain the same categories.
        ordered_items = sorted(import_data.items, key=lambda row: row.category.upper()[:2])
        for item in ordered_items:
            eq_model = EquipmentModel(name=item.name, category=item.category,
                                      description=item.description, lab_id=lab_id)
            db.add(eq_model)
            await db.flush()
            asset_ids = await reserve_asset_ids(db, lab.code, item.category, item.quantity)
            for index, asset_id in enumerate(asset_ids):
                unit = EquipmentUnit(
                    asset_id=asset_id, model_id=eq_model.id, lab_id=lab_id,
                    serial_number=f"{item.serial_prefix}-{index+1}" if item.serial_prefix else None,
                    condition=item.condition or "New", status=UnitStatusEnum.AVAILABLE,
                )
                db.add(unit)
                created_units.append(unit)
        result = {
            "success": True, "alreadyImported": False,
            "modelsCreated": len(import_data.items), "unitsCreated": len(created_units),
            "units": [{"assetId": unit.asset_id, "status": unit.status.value,
                       "condition": unit.condition, "serialNumber": unit.serial_number,
                       "qrCodeUrl": unit.qr_code_url} for unit in created_units],
        }
        batch.result = result
        await db.commit()
        return result
    except Exception:
        await db.rollback()
        raise

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
