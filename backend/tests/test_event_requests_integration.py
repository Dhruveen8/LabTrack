"""Opt-in PostgreSQL API check; all fixture rows are rolled back on completion.

Run with LABTRACK_EVENT_DB_TEST=1 against an already migrated database.
"""
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.endpoints.events import router
from app.db.database import engine, get_db
from app.db.models import (User, RoleEnum, Department, Lab, LabAssistantAssignment,
                           EquipmentModel, EquipmentUnit, Transaction)


@pytest.mark.skipif(os.getenv('LABTRACK_EVENT_DB_TEST') != '1', reason='PostgreSQL integration is opt-in')
@pytest.mark.asyncio
async def test_event_request_api_with_real_transactions():
    suffix = uuid4().hex[:8]
    async with engine.connect() as connection:
        outer = await connection.begin()
        try:
            async with AsyncSession(bind=connection, join_transaction_mode='create_savepoint', expire_on_commit=False) as db:
                faculty = User(name='Event test faculty', email=f'event.faculty.{suffix}@charusat.ac.in', role=RoleEnum.FACULTY)
                assistant = User(name='Event test assistant', email=f'event.assistant.{suffix}@charusat.ac.in', role=RoleEnum.ASSISTANT)
                department = Department(name='Event regression', code=f'EV{suffix}')
                db.add_all([faculty, assistant, department])
                await db.flush()
                lab = Lab(name='Event test lab', code=f'EV{suffix.upper()}', department_id=department.id)
                db.add(lab)
                await db.flush()
                db.add(LabAssistantAssignment(lab_id=lab.id, assistant_id=assistant.id))
                models = [EquipmentModel(name=name, category='MC', lab_id=lab.id) for name in ['Arduino', 'Sensor']]
                db.add_all(models)
                await db.flush()
                units = [EquipmentUnit(asset_id=f'EV-{suffix}-{i}', model_id=models[i % 2].id, lab_id=lab.id) for i in range(4)]
                db.add_all(units)
                await db.commit()
                faculty_id, assistant_id, lab_id = faculty.id, assistant.id, lab.id
                model_ids = [model.id for model in models]
                assets = [unit.asset_id for unit in units]
                current = SimpleNamespace(id=faculty_id, name=faculty.name, role=RoleEnum.FACULTY)
                app = FastAPI()
                app.include_router(router)

                async def session():
                    try:
                        yield db
                    except Exception:
                        await db.rollback()
                        raise

                app.dependency_overrides[get_db] = session
                app.dependency_overrides[get_current_user] = lambda: current
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                    payload = {'event_name': 'Robotics workshop', 'purpose': 'Demonstrations', 'lab_id': lab_id,
                               'due_date': (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                               'requested_items': [{'model_id': model_id, 'quantity': 1} for model_id in model_ids]}
                    response = await client.post('/requests', json=payload)
                    assert response.status_code == 200, response.text
                    request = response.json()
                    assert request['status'] == 'PENDING' and request['unit_asset_ids'] == []
                    assert len(request['requested_items']) == 2
                    count = (await db.execute(select(func.count()).select_from(Transaction).where(Transaction.borrower_id == faculty_id))).scalar_one()
                    assert count == 0
                    current = SimpleNamespace(id=assistant_id, name='Assistant', role=RoleEnum.ASSISTANT)
                    path = f'/requests/{request["id"]}/approve'
                    # Missing allocation and wrong quantities must leave the batch untouched.
                    assert (await client.post(path)).status_code == 400
                    assert (await client.post(path, json={'unit_asset_ids': [assets[0], assets[2]]})).status_code == 400
                    response = await client.post(path, json={'unit_asset_ids': assets[:2]})
                    assert response.status_code == 200, response.text
                    assert response.json()['status'] == 'APPROVED'
                    loans = (await db.execute(select(Transaction).where(Transaction.borrower_id == faculty_id))).scalars().all()
                    assert len(loans) == 2 and {loan.unit_asset_id for loan in loans} == set(assets[:2])
                    assert (await client.post(path, json={'unit_asset_ids': assets[:2]})).status_code == 409
                    # Existing requests that contain asset IDs still work after the migration.
                    current = SimpleNamespace(id=faculty_id, name='Faculty', role=RoleEnum.FACULTY)
                    legacy = {key: value for key, value in payload.items() if key not in ('requested_items', 'lab_id')}
                    legacy['unit_asset_ids'] = assets[2:]
                    response = await client.post('/requests', json=legacy)
                    assert response.status_code == 200, response.text
                    legacy_id = response.json()['id']
                    current = SimpleNamespace(id=assistant_id, name='Assistant', role=RoleEnum.ASSISTANT)
                    response = await client.post(f'/requests/{legacy_id}/approve')
                    assert response.status_code == 200, response.text
        finally:
            await outer.rollback()
    await engine.dispose()
