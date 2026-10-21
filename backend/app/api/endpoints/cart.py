from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.api.deps import require_role
from app.db.database import get_db
from app.db.models import CartItem, EquipmentModel, Lab, User, RoleEnum, RequestKindEnum
from app.schemas.borrowing import CartQuantity, CartSubmit, RequestResponse
from app.services.cart_requests import cart_snapshot, allocate_request, request_response

router = APIRouter()


@router.get('')
async def get_cart(db: AsyncSession = Depends(get_db), user: User = Depends(require_role(RoleEnum.STUDENT))):
    return await cart_snapshot(db, user.id)


@router.put('/items/{model_id}/{lab_id}')
async def update_cart_item(model_id: int, lab_id: int, body: CartQuantity,
                          db: AsyncSession = Depends(get_db), user: User = Depends(require_role(RoleEnum.STUDENT))):
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    if not await db.get(EquipmentModel, model_id) or not await db.get(Lab, lab_id):
        raise HTTPException(404, 'Equipment type or lab not found')
    statement = insert(CartItem).values(user_id=user.id, model_id=model_id, lab_id=lab_id, quantity=body.quantity)
    await db.execute(statement.on_conflict_do_update(index_elements=['user_id', 'model_id', 'lab_id'],
                                                     set_={'quantity': body.quantity}))
    await db.commit()
    # Keep desired quantities even when unavailable, with a current stock warning.
    return await cart_snapshot(db, user.id)


@router.delete('/items/{model_id}/{lab_id}')
async def remove_cart_item(model_id: int, lab_id: int,
                          db: AsyncSession = Depends(get_db), user: User = Depends(require_role(RoleEnum.STUDENT))):
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    item = await db.get(CartItem, (user.id, model_id, lab_id))
    if item:
        await db.delete(item)
    await db.commit()
    return await cart_snapshot(db, user.id)


@router.post('/submit', response_model=RequestResponse)
async def submit_cart(body: CartSubmit, db: AsyncSession = Depends(get_db),
                      user: User = Depends(require_role(RoleEnum.STUDENT))):
    try:
        if body.kind not in (RequestKindEnum.STANDARD, RequestKindEnum.WALK_IN):
            raise HTTPException(400, 'Student carts support standard or small-equipment walk-in requests only')
        request = await allocate_request(db, user, body.items, body.required_from,
            body.required_until, body.purpose, key=body.submission_key, clear_cart=True, faculty_id=body.faculty_id, kind=body.kind)
        await db.commit()
        return await request_response(db, request)
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, {'code': 'ALLOCATION_CONFLICT',
            'message': 'A concurrent submission changed stock or used this submission key. Review the cart and retry.'})
