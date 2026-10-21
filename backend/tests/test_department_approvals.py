"""Real database checks for routing, mixed carts, deadlines and bypass prevention."""
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
from sqlalchemy import select
from app.db.models import User, RoleEnum, Request, RequestItem, EquipmentModel, EquipmentUnit, Department, UnitStatusEnum as US
from app.services.approvals import deadline
from test_cart_integration import api_case, put, payload, selection

pytestmark = [pytest.mark.asyncio, pytest.mark.skipif(os.getenv('LABTRACK_CART_DB_TEST') != '1', reason='PostgreSQL opt-in')]


async def hod_fixture(db, data):
    hod = User(name='Department HOD', email=f'hod.{data["department"].code.lower()}@charusat.ac.in',
        role=RoleEnum.FACULTY, department_id=data['department'].id, is_hod=True)
    db.add(hod)
    await db.flush()
    return SimpleNamespace(**{key: value for key, value in vars(hod).items() if not key.startswith('_')})


async def test_mixed_cart_reserves_then_gates_faculty_hod_and_assistant(monkeypatch):
    async def case(client, db, data, current):
        hod = await hod_fixture(db, data)
        model = await db.get(EquipmentModel, data['models'][1].id)
        model.requires_hod_approval = True
        await db.commit()
        await put(client, data)
        await put(client, data, 1)
        response = await client.post('/api/v1/borrowing/cart/submit', json=payload(data, [selection(data), selection(data, 1)]))
        assert response.status_code == 200, response.text
        request = response.json()
        assert request['created_at']
        assert request['items'][0]['assistant_name'] == data['assistants'][0].name
        assert request['items'][1]['assistant_id'] == data['assistants'][1].id
        assert {item['approval_stage'] for item in request['items']} == {'FACULTY'}
        assert all(item['reserved_asset_ids'] for item in request['items'])
        current[0] = data['assistants'][0]
        assert (await client.post(f'/api/v1/borrowing/requests/{request["id"]}/approve')).status_code == 400
        current[0] = hod
        assert (await client.post(f'/api/v1/borrowing/requests/{request["id"]}/review', json={'approve': True})).status_code == 409
        current[0] = data['faculty']
        response = await client.post(f'/api/v1/borrowing/requests/{request["id"]}/review', json={'approve': True})
        assert response.status_code == 200, response.text
        assert [item['approval_stage'] for item in response.json()['items']] == ['HOD', 'HOD']
        assert all(item['collection_deadline'] is None for item in response.json()['items'])
        # Pre-change requests may have started the small-item collection clock.
        # It must no longer shorten approval time or be exposed as a pickup deadline.
        old_item = await db.get(RequestItem, request['items'][0]['id'])
        old_item.collection_deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()
        refreshed = (await client.get('/api/v1/borrowing/requests')).json()
        assert all(item['collection_deadline'] is None for row in refreshed if row['id'] == request['id'] for item in row['items'])
        current[0] = data['assistants'][0]
        assert not any(row['id'] == request['id'] for row in (await client.get('/api/v1/borrowing/requests')).json())
        assert not any(row['id'] == request['id'] for row in (await client.get('/api/v1/borrowing/requests/pending')).json())
        assert (await client.post(f'/api/v1/borrowing/requests/{request["id"]}/approve')).status_code == 400
        assert (await client.post('/api/v1/borrowing/checkout', json={
            'request_id': request['id'], 'asset_id': request['items'][0]['reserved_asset_ids'][0]})).status_code == 409
        current[0] = data['assistants'][1]
        assert (await client.post(f'/api/v1/borrowing/requests/{request["id"]}/approve')).status_code == 400
        current[0] = hod
        response = await client.post(f'/api/v1/borrowing/requests/{request["id"]}/review', json={'approve': True})
        assert response.status_code == 200, response.text
        assert response.json()['items'][1]['collection_deadline']
        assert len(response.json()['approval_history']) == 2
        assert all(item['collection_deadline'] for item in response.json()['items'])
        current[0] = data['assistants'][0]
        assert any(row['id'] == request['id'] for row in (await client.get('/api/v1/borrowing/requests/pending')).json())
        assert (await client.post(f'/api/v1/borrowing/requests/{request["id"]}/approve')).status_code == 200
        current[0] = data['assistants'][1]
        assert (await client.post(f'/api/v1/borrowing/requests/{request["id"]}/approve')).status_code == 200
    await api_case(case, monkeypatch)


async def test_wrong_faculty_rejection_and_expired_approval(monkeypatch):
    async def case(client, db, data, current):
        hod = await hod_fixture(db, data)
        await put(client, data)
        body = payload(data, [selection(data)])
        body['faculty_id'] = data['assistants'][0].id
        assert (await client.post('/api/v1/borrowing/cart/submit', json=body)).status_code == 400
        body['faculty_id'] = data['faculty'].id
        response = await client.post('/api/v1/borrowing/cart/submit', json=body)
        assert response.status_code == 200, response.text
        request = response.json()
        current[0] = hod
        assert (await client.post(f'/api/v1/borrowing/requests/{request["id"]}/review', json={'approve': True})).status_code == 403
        current[0] = data['faculty']
        assert (await client.post(f'/api/v1/borrowing/requests/{request["id"]}/review', json={'approve': False})).status_code == 400
        response = await client.post(f'/api/v1/borrowing/requests/{request["id"]}/review', json={'approve': False, 'reason': 'Project not supervised'})
        assert response.status_code == 200 and response.json()['status'] == 'REJECTED'
        assert await db.scalar(select(EquipmentUnit.status).where(EquipmentUnit.asset_id == data['units'][0].asset_id)) == US.AVAILABLE
        current[0] = data['users'][0]
        await put(client, data)
        response = await client.post('/api/v1/borrowing/cart/submit', json=payload(data, [selection(data)]))
        row = await db.get(Request, response.json()['id'])
        row.approval_deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.flush()
        current[0] = data['faculty']
        assert (await client.post(f'/api/v1/borrowing/requests/{row.id}/review', json={'approve': True})).status_code == 409
    await api_case(case, monkeypatch)


async def test_hod_personal_borrowing_and_quick_walkin_restrictions(monkeypatch):
    async def case(client, db, data, current):
        hod = await hod_fixture(db, data)
        model = await db.get(EquipmentModel, data['models'][0].id)
        model.requires_hod_approval = True
        await db.commit()
        current[0] = data['faculty']
        base = dict(model_id=model.id, required_from=datetime.now(timezone.utc).isoformat(),
            required_until=(datetime.now(timezone.utc) + timedelta(days=2)).isoformat(), quantity=1)
        assert (await client.post('/api/v1/borrowing/requests', json={**base, 'kind': 'QUICK_BORROW'})).status_code == 400
        assert (await client.post('/api/v1/borrowing/requests', json={**base, 'kind': 'WALK_IN'})).status_code == 400
        current[0] = hod
        response = await client.post('/api/v1/borrowing/requests', json=base)
        assert response.status_code == 200, response.text
        assert response.json()['items'][0]['approval_stage'] == 'ASSISTANT'
        assert response.json()['hod_id'] is None
    await api_case(case, monkeypatch)


async def test_collection_has_new_seven_days_without_restarting_approval_clock(monkeypatch):
    async def case(client, db, data, current):
        await put(client, data)
        body = payload(data, [selection(data)])
        body['required_until'] = (datetime.fromisoformat(body['required_from']) + timedelta(days=14)).isoformat()
        response = await client.post('/api/v1/borrowing/cart/submit', json=body)
        assert response.status_code == 200, response.text
        row = await db.get(Request, response.json()['id'])
        original = row.approval_deadline
        current[0] = data['faculty']
        response = await client.post(f'/api/v1/borrowing/requests/{row.id}/review', json={'approve': True})
        assert response.status_code == 200, response.text
        item = await db.scalar(select(RequestItem).where(RequestItem.request_id == row.id))
        assert row.approval_deadline == original
        assert timedelta(days=7) - timedelta(seconds=3) < item.collection_deadline - datetime.now(timezone.utc) <= timedelta(days=7)
        assert deadline(row, item) == item.collection_deadline
    await api_case(case, monkeypatch)


async def test_hod_rejection_releases_only_flagged_items_and_borrower_can_cancel_rest(monkeypatch):
    async def case(client, db, data, current):
        hod = await hod_fixture(db, data)
        model = await db.get(EquipmentModel, data['models'][1].id)
        model.requires_hod_approval = True
        await db.flush()
        await put(client, data)
        await put(client, data, 1)
        response = await client.post('/api/v1/borrowing/cart/submit', json=payload(data, [selection(data), selection(data, 1)]))
        request_id = response.json()['id']
        current[0] = data['faculty']
        assert (await client.post(f'/api/v1/borrowing/requests/{request_id}/review', json={'approve': True})).status_code == 200
        current[0] = hod
        response = await client.post(f'/api/v1/borrowing/requests/{request_id}/review', json={'approve': False, 'reason': 'Not needed for project'})
        assert response.status_code == 200, response.text
        items = response.json()['items']
        assert items[0]['status'] == 'PENDING' and items[0]['reserved_asset_ids']
        assert items[0]['approval_stage'] == 'ASSISTANT' and items[0]['collection_deadline']
        assert items[1]['status'] == 'REJECTED' and not items[1]['reserved_asset_ids']
        assert response.json()['approval_history'][-1]['item_ids'] == [items[1]['id']]
        current[0] = data['assistants'][0]
        assert any(row['id'] == request_id for row in (await client.get('/api/v1/borrowing/requests/pending')).json())
        assert (await client.post(f'/api/v1/borrowing/requests/{request_id}/approve')).status_code == 200
        current[0] = data['users'][1]
        assert (await client.post(f'/api/v1/borrowing/requests/{request_id}/cancel')).status_code == 404
        current[0] = data['users'][0]
        response = await client.post(f'/api/v1/borrowing/requests/{request_id}/cancel')
        assert response.status_code == 200 and all(not item['reserved_asset_ids'] for item in response.json()['items'])
    await api_case(case, monkeypatch)


async def test_assistant_manages_multiple_labs_only_in_own_department(monkeypatch):
    from app.api.endpoints.labs import assign_assistant
    from app.services.lab_access import get_assistant_labs
    from fastapi import HTTPException
    async def case(client, db, data, current):
        admin = SimpleNamespace(id=data['users'][0].id)
        assistant = await db.get(User, data['assistants'][0].id)
        await assign_assistant(data['labs'][1].id, assistant.id, db, admin)
        assert set(await get_assistant_labs(db, assistant.id)) == {lab.id for lab in data['labs']}
        foreign = Department(name='Other department', code='OTHER' + data['department'].code)
        db.add(foreign)
        await db.flush()
        other = User(name='Foreign assistant', email=f'other.{foreign.code.lower()}@charusat.ac.in', role=RoleEnum.ASSISTANT, department_id=foreign.id)
        db.add(other)
        await db.flush()
        with pytest.raises(HTTPException) as error:
            await assign_assistant(data['labs'][0].id, other.id, db, admin)
        assert error.value.status_code == 400
    await api_case(case, monkeypatch)


async def test_approval_and_collection_expiry_are_separate_and_release_stock(monkeypatch):
    from app.services import cart_requests
    from app.db import database
    async def case(client, db, data, current):
        await put(client, data)
        body = payload(data, [selection(data)])
        body['required_until'] = (datetime.fromisoformat(body['required_from']) + timedelta(days=14)).isoformat()
        response = await client.post('/api/v1/borrowing/cart/submit', json=body)
        request_id = response.json()['id']
        current[0] = data['faculty']
        assert (await client.post(f'/api/v1/borrowing/requests/{request_id}/review', json={'approve': True})).status_code == 200
        row = await db.get(Request, request_id)
        row.approval_deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.flush()
        class BoundSession:
            async def __aenter__(self): return db
            async def __aexit__(self, *args): return False
        monkeypatch.setattr(database, 'AsyncSessionLocal', BoundSession)
        await cart_requests.expire_allocations()
        item = await db.scalar(select(RequestItem).where(RequestItem.request_id == request_id))
        assert item.status.value == 'PENDING'  # Completed academic approvals start a fresh collection window.
        item.collection_deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.flush()
        await cart_requests.expire_allocations()
        assert item.status.value == 'CANCELLED'
        assert await db.scalar(select(EquipmentUnit.status).where(EquipmentUnit.asset_id == data['units'][0].asset_id)) == US.AVAILABLE
    await api_case(case, monkeypatch)


async def test_foreign_department_faculty_cannot_be_selected_and_hod_assignment_is_unique(monkeypatch):
    from app.api.endpoints.auth import update_user
    from app.schemas.user import UserUpdate
    from fastapi import HTTPException
    async def case(client, db, data, current):
        await hod_fixture(db, data)
        foreign = Department(name='Foreign faculty department', code='FF' + data['department'].code)
        db.add(foreign)
        await db.flush()
        faculty = User(name='Foreign faculty', email=f'foreign.{foreign.code.lower()}@charusat.ac.in', role=RoleEnum.FACULTY, department_id=foreign.id)
        db.add(faculty)
        await db.flush()
        foreign_id = faculty.id
        await put(client, data)
        listed = (await client.get('/api/v1/auth/department-faculty')).json()
        assert {row['id'] for row in listed} == {data['faculty'].id}
        body = payload(data, [selection(data)])
        body['faculty_id'] = foreign_id
        assert (await client.post('/api/v1/borrowing/cart/submit', json=body)).status_code == 400
        with pytest.raises(HTTPException) as error:
            await update_user(data['faculty'].id, UserUpdate(is_hod=True), db, SimpleNamespace(id=data['users'][0].id))
        assert error.value.status_code == 409
    await api_case(case, monkeypatch)
