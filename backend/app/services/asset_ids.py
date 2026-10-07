"""Reserve asset ID ranges in the same transaction that inserts their units."""
import re

from sqlalchemy import Integer, cast, func, select
from sqlalchemy.dialects.postgresql import insert

from app.db.models import AssetSequence, EquipmentUnit


async def reserve_asset_ids(db, lab_code: str, category: str, quantity: int):
    if quantity < 1:
        raise ValueError("quantity must be positive")
    # Preserve existing prefixes so old tags and new units share one counter.
    prefix = f"LT-{lab_code.upper()}-{category.upper()[:2]}-"
    suffix = func.substr(EquipmentUnit.asset_id, len(prefix) + 1)
    existing_max = (await db.execute(
        select(func.coalesce(func.max(cast(suffix, Integer)), 0))
        .where(EquipmentUnit.asset_id.op("~")(f"^{re.escape(prefix)}[0-9]+$"))
    )).scalar_one()
    # ON CONFLICT locks the prefix row: concurrent single, bulk and Excel
    # writers reserve disjoint ranges, including on the first allocation.
    statement = insert(AssetSequence).values(prefix=prefix, last_value=existing_max + quantity)
    statement = statement.on_conflict_do_update(
        index_elements=[AssetSequence.prefix],
        set_={"last_value": func.greatest(AssetSequence.last_value, existing_max) + quantity},
    ).returning(AssetSequence.last_value)
    last = (await db.execute(statement)).scalar_one()
    return [f"{prefix}{number:05d}" for number in range(last - quantity + 1, last + 1)]
