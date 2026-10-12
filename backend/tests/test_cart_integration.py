"""Real PostgreSQL cart/API and race checks. SMTP workers are never started.

Enable with LABTRACK_CART_DB_TEST=1 against the migrated local database.
API fixtures roll back; concurrency fixtures are UUID-scoped and deleted in finally.
"""
import asyncio
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.database import get_db
from app.db.models import (User, RoleEnum, Department, Lab, LabAssistantAssignment,
    EquipmentModel, EquipmentUnit, Request, RequestItem, RequestAllocation, CartItem,
    Transaction, Notification, NotificationEmail, RequestStatusEnum as RS, UnitStatusEnum as US)
from app.api.deps import get_current_user
from app.api.endpoints import cart, borrowing, auth
from app.schemas.borrowing import CartSelection, CheckoutRequest
from app.services.cart_requests import allocate_request

pytestmark = [pytest.mark.skipif(os.getenv('LABTRACK_CART_DB_TEST') != '1', reason='PostgreSQL cart tests are opt-in'), pytest.mark.asyncio]


async def fixtures(db, quantities=(1, 2)):
    suffix = uuid4().hex[:8]
    users = [User(name=f'Cart student {i}', email=f'cart.{suffix}.{i}@charusat.edu.in',
                  university_id=f'CART{suffix.upper()}{i}', role=RoleEnum.STUDENT) for i in range(2)]
    assistants = [User(name=f'Cart assistant {i}', email=f'cart.{suffix}.{i}@charusat.ac.in', role=RoleEnum.ASSISTANT) for i in range(2)]
    dept = Department(name=f'Cart department {suffix}', code=f'CT{suffix}')
    db.add_all([*users, *assistants, dept])
    await db.flush()
    labs = [Lab(name=f'Cart Lab {i}', code=f'CT{suffix.upper()}{i}', department_id=dept.id) for i in range(2)]
    db.add_all(labs)
    await db.flush()
    db.add_all([LabAssistantAssignment(lab_id=lab.id, assistant_id=assistant.id) for lab, assistant in zip(labs, assistants)])
    models = [EquipmentModel(name=f'Cart Model {i}', lab_id=lab.id, category='MC') for i, lab in enumerate(labs)]
    db.add_all(models)
    await db.flush()
    units = []
    for i, (model, lab, quantity) in enumerate(zip(models, labs, quantities)):
        for j in range(quantity):
            units.append(EquipmentUnit(asset_id=f'CART-{suffix}-{i}-{j}', model_id=model.id, lab_id=lab.id))
    db.add_all(units)
    await db.flush()
    # HTTP requests use separate auth loads in production. Keep fixture identities
    # outside the session so a deliberate API rollback cannot expire the next user.
    def snapshot(row):
        return SimpleNamespace(**{key: value for key, value in vars(row).items() if not key.startswith('_')})
    return dict(users=list(map(snapshot, users)), assistants=list(map(snapshot, assistants)),
                labs=list(map(snapshot, labs)), models=list(map(snapshot, models)),
                units=list(map(snapshot, units)), department=snapshot(dept))


def payload(items, key=None):
    now = datetime.now(timezone.utc)
    return dict(items=items, required_from=now.isoformat(), required_until=(now + timedelta(days=2)).isoformat(),
                purpose='Cart regression', submission_key=key or str(uuid4()))


def selection(data, index=0, quantity=1):
    return dict(model_id=data['models'][index].id, lab_id=data['labs'][index].id, quantity=quantity)


def application(db, current):
    app = FastAPI()
    app.include_router(cart.router, prefix='/api/v1/borrowing/cart')
    app.include_router(borrowing.router, prefix='/api/v1/borrowing')
    app.include_router(auth.router, prefix='/api/v1/auth')
    async def session():
        try:
            yield db
        except Exception:
            await db.rollback()
            raise
    app.dependency_overrides[get_db] = session
    app.dependency_overrides[get_current_user] = lambda: current[0]
    return app


async def put(client, data, index=0, quantity=1):
    item = selection(data, index, quantity)
    return await client.put(f'/api/v1/borrowing/cart/items/{item["model_id"]}/{item["lab_id"]}', json={'quantity': quantity})


async def api_case(case, monkeypatch):
    monkeypatch.setattr(settings, 'SMTP_ENABLED', True)
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    async with engine.connect() as connection:
        outer = await connection.begin()
        try:
            async with AsyncSession(bind=connection, join_transaction_mode='create_savepoint', expire_on_commit=False) as db:
                data = await fixtures(db)
                current = [data['users'][0]]
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application(db, current)), base_url='http://test') as client:
                    await case(client, db, data, current)
        finally:
            await outer.rollback()
    await engine.dispose()


async def test_last_unit_cart_is_not_a_reservation_and_stale_submit_is_atomic(monkeypatch):
    async def case(client, db, data, current):
        assert (await put(client, data)).json()['items'][0]['available_quantity'] == 1
        assert await db.scalar(select(EquipmentUnit.status).where(EquipmentUnit.asset_id == data['units'][0].asset_id)) == US.AVAILABLE
        assert await db.scalar(select(func.count(RequestAllocation.asset_id)).where(RequestAllocation.asset_id == data['units'][0].asset_id)) == 0
        current[0] = data['users'][1]
        await put(client, data)
        submitted = await client.post('/api/v1/borrowing/cart/submit', json=payload([selection(data)]))
        assert submitted.status_code == 200, submitted.text
        assert submitted.json()['items'][0]['quantity'] == 1
        current[0] = data['users'][0]
        stale = (await client.get('/api/v1/borrowing/cart')).json()
        assert stale['items'][0]['unavailable'] and not stale['can_submit']
        # A second available type must remain untouched when the first is short.
        await put(client, data, 1)
        response = await client.post('/api/v1/borrowing/cart/submit', json=payload([selection(data), selection(data, 1)]))
        assert response.status_code == 409 and response.json()['detail']['code'] == 'INSUFFICIENT_STOCK'
        assert await db.scalar(select(func.count(Request.id)).where(Request.requester_id == current[0].id)) == 0
        assert await db.scalar(select(EquipmentUnit.status).where(EquipmentUnit.asset_id == data['units'][1].asset_id)) == US.AVAILABLE
        kept = (await client.get('/api/v1/borrowing/cart')).json()
        assert len(kept['items']) == 2 and all(item['quantity'] == 1 for item in kept['items'])
        # A stock decrease retains the requested quantity and shows insufficiency.
        assert (await put(client, data, 1, 3)).json()['items'][1]['insufficient']
        assert (await client.put(f'/api/v1/borrowing/cart/items/{data["models"][1].id}/{data["labs"][1].id}', json={'quantity': 0})).status_code == 422
    await api_case(case, monkeypatch)


async def test_multi_lab_approval_barcode_issue_partial_return_and_email_context(monkeypatch):
    async def case(client, db, data, current):
        await put(client, data)
        await put(client, data, 1, 2)
        response = await client.post('/api/v1/borrowing/cart/submit', json=payload([selection(data), selection(data, 1, 2)]))
        assert response.status_code == 200, response.text
        request = response.json()
        request_id = request['id']
        assert request['quantity'] == 3 and len(request['items']) == 2
        assert not (await client.get('/api/v1/borrowing/cart')).json()['items']
        current[0] = data['assistants'][0]
        lookup = await client.get('/api/v1/auth/users/lookup', params={'q': data['users'][0].university_id})
        assert lookup.status_code == 200 and lookup.json()[0]['id'] == data['users'][0].id
        approved = await client.post(f'/api/v1/borrowing/requests/{request_id}/approve')
        assert approved.status_code == 200 and approved.json()['status'] == 'PENDING'
        assert approved.json()['items'][0]['status'] == 'APPROVED'
        assert approved.json()['items'][1]['status'] == 'PENDING'
        # The first assistant cannot issue a unit in the second lab.
        issue_url = '/api/v1/borrowing/checkout'
        assert (await client.post(issue_url, json={'request_id': request_id, 'asset_id': data['units'][1].asset_id})).status_code == 403
        asset = request['items'][0]['reserved_asset_ids'][0]
        scanned = await client.post(issue_url, json={'request_id': request_id, 'asset_id': asset})
        assert scanned.status_code == 200, scanned.text
        tx = scanned.json()
        queued = (await db.execute(select(NotificationEmail).join(Notification).where(
            Notification.user_id == data['users'][0].id, Notification.title == 'Equipment Checked Out'))).scalar_one()
        assert queued.email_context == {'kind': 'issued', 'transaction_ids': [tx['id']]}
        assert (await client.post(issue_url, json={'request_id': request_id, 'asset_id': asset})).status_code == 409
        assert (await client.post('/api/v1/borrowing/return', json={'asset_id': asset})).status_code == 200
        # Returning the early pickup must not finish the outstanding request.
        assert (await db.get(Request, request_id)).status == RS.PENDING
        current[0] = data['assistants'][1]
        listed = (await client.get('/api/v1/borrowing/requests')).json()
        assert any(row['id'] == request_id for row in listed)
        assert (await client.post(f'/api/v1/borrowing/requests/{request_id}/approve')).status_code == 200
        second = request['items'][1]['reserved_asset_ids']
        for asset in second:
            issued = await client.post(issue_url, json={'request_id': request_id, 'asset_id': asset})
            assert issued.status_code == 200, issued.text
            assert issued.json()['request_item_id'] == request['items'][1]['id']
            assert (await client.post('/api/v1/borrowing/return', json={'asset_id': asset})).status_code == 200
        assert (await db.get(Request, request_id)).status == RS.RETURNED
        transactions = (await client.get('/api/v1/borrowing/transactions')).json()
        assert all(row['equipment_name'] == data['models'][1].name for row in transactions)
        assert all(row['lab_name'] == data['labs'][1].name for row in transactions)
    await api_case(case, monkeypatch)


async def test_partial_rejection_releases_only_assistants_lab(monkeypatch):
    async def case(client, db, data, current):
        await put(client, data)
        await put(client, data, 1)
        response = await client.post('/api/v1/borrowing/cart/submit', json=payload([selection(data), selection(data, 1)]))
        request = response.json()
        current[0] = data['assistants'][0]
        response = await client.post(f'/api/v1/borrowing/requests/{request["id"]}/reject')
        assert response.status_code == 200, response.text
        assert response.json()['items'][0]['status'] == 'REJECTED'
        assert response.json()['items'][1]['status'] == 'PENDING'
        assert await db.scalar(select(EquipmentUnit.status).where(EquipmentUnit.asset_id == data['units'][0].asset_id)) == US.AVAILABLE
        current[0] = data['users'][0]
        assert (await put(client, data)).json()['items'][0]['available_quantity'] == 1
    await api_case(case, monkeypatch)


async def test_changed_cart_and_replayed_submission_are_not_silently_accepted(monkeypatch):
    async def case(client, db, data, current):
        await put(client, data)
        original = payload([selection(data)])
        # A quantity changed on another device requires another review.
        await put(client, data, quantity=2)
        response = await client.post('/api/v1/borrowing/cart/submit', json=original)
        assert response.status_code == 409 and response.json()['detail']['code'] == 'CART_CHANGED'
        await put(client, data, quantity=1)
        created = await client.post('/api/v1/borrowing/cart/submit', json=original)
        repeated = await client.post('/api/v1/borrowing/cart/submit', json=original)
        assert repeated.status_code == 200 and repeated.json()['id'] == created.json()['id']
        assert await db.scalar(select(func.count(Request.id)).where(Request.requester_id == current[0].id)) == 1
        # Reusing a key with different details must not return an unrelated success.
        changed = dict(original, purpose='Changed purpose')
        assert (await client.post('/api/v1/borrowing/cart/submit', json=changed)).status_code == 409
    await api_case(case, monkeypatch)


async def test_expiry_releases_uncollected_units_without_restocking_active_loans(monkeypatch):
    async def case(client, db, data, current):
        await put(client, data)
        await put(client, data, 1, 2)
        request = (await client.post('/api/v1/borrowing/cart/submit', json=payload([
            selection(data), selection(data, 1, 2)]))).json()
        current[0] = data['assistants'][1]
        await client.post(f'/api/v1/borrowing/requests/{request["id"]}/approve')
        issued_asset = request['items'][1]['reserved_asset_ids'][0]
        assert (await client.post('/api/v1/borrowing/checkout', json={
            'request_id': request['id'], 'asset_id': issued_asset})).status_code == 200
        from app.services import cart_requests
        from app.db import database
        class BoundSession:
            async def __aenter__(self): return db
            async def __aexit__(self, *args): return False
        monkeypatch.setattr(database, 'AsyncSessionLocal', BoundSession)
        original_select = cart_requests.select
        def fixture_select(*entities):
            statement = original_select(*entities)
            return statement.where(Request.id == request['id']) if len(entities) == 1 and entities[0] is Request else statement
        monkeypatch.setattr(cart_requests, 'select', fixture_select)
        future = datetime.fromisoformat(request['required_until']) + timedelta(minutes=1)
        await cart_requests.expire_allocations(future)
        await cart_requests.expire_allocations(future)
        assert await db.scalar(select(EquipmentUnit.status).where(EquipmentUnit.asset_id == issued_asset)) == US.ISSUED
        assert await db.scalar(select(EquipmentUnit.status).where(EquipmentUnit.asset_id == data['units'][0].asset_id)) == US.AVAILABLE
        assert (await db.get(Request, request['id'])).status == RS.ISSUED
        assert await db.scalar(select(func.count(RequestAllocation.asset_id)).join(RequestItem)
            .where(RequestItem.request_id == request['id'])) == 0
        assert await db.scalar(select(func.count(Notification.id)).where(
            Notification.user_id == data['users'][0].id, Notification.title == 'Uncollected Request Items Expired')) == 1
        assert (await client.post('/api/v1/borrowing/return', json={'asset_id': issued_asset})).status_code == 200
    await api_case(case, monkeypatch)


async def cleanup(db, data):
    """Delete only fixture IDs returned by this test's own setup."""
    user_ids = [row.id for row in data['users'] + data['assistants']]
    model_ids = [row.id for row in data['models']]
    lab_ids = [row.id for row in data['labs']]
    requests = select(Request.id).where(Request.requester_id.in_(user_ids))
    items = select(RequestItem.id).where(RequestItem.request_id.in_(requests))
    await db.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
    await db.execute(delete(Transaction).where(Transaction.borrower_id.in_(user_ids)))
    await db.execute(delete(RequestAllocation).where(RequestAllocation.request_item_id.in_(items)))
    await db.execute(delete(RequestItem).where(RequestItem.request_id.in_(requests)))
    await db.execute(delete(Request).where(Request.requester_id.in_(user_ids)))
    await db.execute(delete(CartItem).where(CartItem.user_id.in_(user_ids)))
    await db.execute(delete(LabAssistantAssignment).where(LabAssistantAssignment.lab_id.in_(lab_ids)))
    await db.execute(delete(EquipmentUnit).where(EquipmentUnit.model_id.in_(model_ids)))
    await db.execute(delete(EquipmentModel).where(EquipmentModel.id.in_(model_ids)))
    await db.execute(delete(Lab).where(Lab.id.in_(lab_ids)))
    await db.execute(delete(User).where(User.id.in_(user_ids)))
    await db.execute(delete(Department).where(Department.id == data['department'].id))
    await db.commit()


async def test_concurrent_last_unit_and_idempotent_retry_and_repeated_issue(monkeypatch):
    monkeypatch.setattr(settings, 'SMTP_ENABLED', False)
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        data = await fixtures(db)
        await db.commit()
    winner_locked, loser_finished = asyncio.Event(), asyncio.Event()
    try:
        async def attempt(index, hold=False):
            async with sessions() as db:
                user = await db.get(User, data['users'][index].id)
                try:
                    now = datetime.now(timezone.utc)
                    result = await allocate_request(db, user, [CartSelection(**selection(data))], now,
                                                    now + timedelta(days=2), 'Concurrent regression')
                    if hold:
                        winner_locked.set()
                        await asyncio.wait_for(loser_finished.wait(), 10)
                    await db.commit()
                    return result.id
                except HTTPException as error:
                    await db.rollback()
                    return error.status_code
                finally:
                    if not hold:
                        loser_finished.set()
        winner = asyncio.create_task(attempt(0, True))
        await asyncio.wait_for(winner_locked.wait(), 10)
        loser = await asyncio.wait_for(attempt(1), 10)
        request_id = await winner
        assert loser == 409
        async with sessions() as db:
            assert await db.scalar(select(func.count(RequestAllocation.asset_id)).where(RequestAllocation.asset_id == data['units'][0].asset_id)) == 1

        # One user/key submitted twice must allocate only once, even after their cart is cleared.
        key = str(uuid4())
        retry_start = datetime.now(timezone.utc)
        async def retry():
            async with sessions() as db:
                user = await db.get(User, data['users'][0].id)
                result = await allocate_request(db, user, [CartSelection(**selection(data, 1))], retry_start,
                    retry_start + timedelta(days=2), 'Idempotency regression', key=key)
                await db.commit()
                return result.id
        ids = await asyncio.gather(retry(), retry())
        assert ids[0] == ids[1]
        async with sessions() as db:
            assert await db.scalar(select(func.count(Request.id)).where(Request.submission_key == key)) == 1
            request = await db.get(Request, request_id)
            request.status = RS.APPROVED
            item = (await db.scalars(select(RequestItem).where(RequestItem.request_id == request_id))).one()
            item.status = RS.APPROVED
            await db.commit()
        async def issue():
            async with sessions() as db:
                assistant = await db.get(User, data['assistants'][0].id)
                try:
                    tx = await borrowing.checkout_equipment(CheckoutRequest(request_id=request_id,
                        asset_id=data['units'][0].asset_id), db, assistant)
                    return tx.id
                except HTTPException as error:
                    await db.rollback()
                    return error.status_code
        outcomes = await asyncio.gather(issue(), issue())
        assert outcomes.count(409) == 1
        async with sessions() as db:
            assert await db.scalar(select(func.count(Transaction.id)).where(Transaction.unit_asset_id == data['units'][0].asset_id)) == 1
    finally:
        async with sessions() as db:
            await cleanup(db, data)
        await engine.dispose()
