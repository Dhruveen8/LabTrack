from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text
from datetime import datetime, timezone

from app.db.database import get_db
from app.db.models import (
    User,
    EquipmentModel,
    EquipmentUnit,
    Transaction,
    Request,
    Transfer,
    Lab,
    UnitStatusEnum,
    TransactionStatusEnum,
    TransferStatusEnum,
)
from app.api.deps import require_admin

router = APIRouter()

@router.get("/reports/system")
async def get_system_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Generate overall system statistics."""
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Models count
    total_models = (await db.execute(select(func.count(EquipmentModel.id)))).scalar() or 0

    # Units count
    units_result = (await db.execute(select(EquipmentUnit.status, func.count(EquipmentUnit.asset_id)).group_by(EquipmentUnit.status))).all()
    status_counts = {r[0]: r[1] for r in units_result}
    total_units = sum(status_counts.values())

    # Transactions count
    total_transactions = (await db.execute(select(func.count(Transaction.id)))).scalar() or 0

    active_transactions = (await db.execute(
        select(func.count(Transaction.id)).where(Transaction.status == TransactionStatusEnum.ACTIVE)
    )).scalar() or 0

    overdue_transactions = (await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.status == TransactionStatusEnum.ACTIVE)
        .where(Transaction.due_date < now)
    )).scalar() or 0

    this_month_transactions = (await db.execute(
        select(func.count(Transaction.id)).where(Transaction.issue_date >= start_of_month)
    )).scalar() or 0

    active_transfers = (await db.execute(
        select(func.count(Transfer.id)).where(Transfer.status.in_([TransferStatusEnum.PENDING, TransferStatusEnum.APPROVED]))
    )).scalar() or 0

    return {
        "totalModels": total_models,
        "totalUnits": total_units,
        "availableUnits": status_counts.get(UnitStatusEnum.AVAILABLE, 0),
        "issuedUnits": status_counts.get(UnitStatusEnum.ISSUED, 0),
        "maintenanceUnits": status_counts.get(UnitStatusEnum.MAINTENANCE, 0),
        "totalTransactions": total_transactions,
        "activeTransactions": active_transactions,
        "overdueTransactions": overdue_transactions,
        "thisMonthTransactions": this_month_transactions,
        "activeTransfers": active_transfers,
    }

@router.get("/reports/trends")
async def get_borrowing_trends(
    months: int = 6,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Generate monthly borrowing trends."""
    now = datetime.now(timezone.utc)
    trends = []

    # Calculate months using basic math
    current_year = now.year
    current_month = now.month

    for i in range(months - 1, -1, -1):
        # Calculate target month and year
        target_month = current_month - i
        target_year = current_year
        while target_month <= 0:
            target_month += 12
            target_year -= 1

        start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)

        # Next month calculation for end_date
        next_month = target_month + 1
        next_year = target_year
        if next_month > 12:
            next_month = 1
            next_year += 1
        end_date = datetime(next_year, next_month, 1, tzinfo=timezone.utc)

        count = (await db.execute(
            select(func.count(Transaction.id))
            .where(Transaction.issue_date >= start_date)
            .where(Transaction.issue_date < end_date)
        )).scalar() or 0

        month_name = start_date.strftime("%b")
        trends.append({"name": month_name, "value": count})

    return trends

@router.get("/reports/lab-utilization")
async def get_lab_utilization(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Calculate utilization per lab."""
    labs = (await db.execute(select(Lab))).scalars().all()
    utilization_data = []

    for lab in labs:
        # Get units for this lab
        units = (await db.execute(
            select(EquipmentUnit.status, func.count(EquipmentUnit.asset_id))
            .join(EquipmentModel, EquipmentModel.id == EquipmentUnit.model_id)
            .where(EquipmentModel.lab_id == lab.id)
            .group_by(EquipmentUnit.status)
        )).all()

        status_counts = {r[0]: r[1] for r in units}
        total = sum(status_counts.values())
        issued = status_counts.get(UnitStatusEnum.ISSUED, 0)

        util_pct = round((issued / total * 100)) if total > 0 else 0

        utilization_data.append({
            "name": lab.name,
            "value": util_pct,
            "total": total,
            "issued": issued,
            "available": status_counts.get(UnitStatusEnum.AVAILABLE, 0),
            "maintenance": status_counts.get(UnitStatusEnum.MAINTENANCE, 0)
        })

    return utilization_data

@router.get("/reports/top-equipment")
async def get_top_equipment(
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get most used equipment models."""
    # Count transactions per unit, then map to model
    result = (await db.execute(
        select(EquipmentModel.name, func.count(Transaction.id).label("tx_count"))
        .join(EquipmentUnit, EquipmentUnit.model_id == EquipmentModel.id)
        .join(Transaction, Transaction.unit_asset_id == EquipmentUnit.asset_id)
        .group_by(EquipmentModel.id, EquipmentModel.name)
        .order_by(text("tx_count DESC"))
        .limit(limit)
    )).all()

    return [{"name": row.name, "value": row.tx_count} for row in result]

@router.get("/procurement/suggestions")
async def get_procurement_suggestions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Smart procurement suggestions based on real utilization."""
    models = (await db.execute(select(EquipmentModel))).scalars().all()
    suggestions = []

    for model in models:
        # Pending requests for this model
        pending_requests = (await db.execute(
            select(func.count(Request.id))
            .where(Request.model_id == model.id)
            .where(Request.status == "PENDING")
        )).scalar() or 0

        # Unit statuses
        units = (await db.execute(
            select(EquipmentUnit.status, func.count(EquipmentUnit.asset_id))
            .where(EquipmentUnit.model_id == model.id)
            .group_by(EquipmentUnit.status)
        )).all()

        status_counts = {r[0]: r[1] for r in units}
        total = sum(status_counts.values())
        issued = status_counts.get(UnitStatusEnum.ISSUED, 0)

        util_pct = round((issued / total * 100)) if total > 0 else 0

        suggestion = None
        reason = None
        if total == 0:
            suggestion = "Purchase Initial Stock"
            reason = "No units exist in inventory."
        elif util_pct > 80:
            suggestion = f"Buy {max(2, pending_requests + 2)} more"
            reason = f"High utilization rate ({util_pct}%). Frequent shortages likely."
        elif pending_requests > status_counts.get(UnitStatusEnum.AVAILABLE, 0):
            suggestion = f"Buy {pending_requests} more"
            reason = f"Pending requests ({pending_requests}) exceed available units."

        if suggestion:
            suggestions.append({
                "model_id": model.id,
                "name": model.name,
                "suggestion": suggestion,
                "reason": reason,
                "utilizationPct": util_pct,
                "currentStock": total,
                "pendingRequests": pending_requests
            })

    return suggestions
