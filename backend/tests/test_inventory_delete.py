"""Deletion regressions using an isolated SQLite database with foreign keys enabled."""
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import CheckConstraint, MetaData, create_engine, event, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.endpoints.inventory import router
from app.db.database import Base, get_db
from app.db.models import (
    Department, Lab, EquipmentModel, EquipmentUnit, Request, User,
    RoleEnum, Transaction, TransactionStatusEnum,
)


@pytest.fixture
def inventory():
    engine = create_engine('sqlite:///:memory:')

    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

    metadata = MetaData()
    for table in Base.metadata.sorted_tables:
        copy = table.to_metadata(metadata)
        for constraint in list(copy.constraints):
            if isinstance(constraint, CheckConstraint) and '~' in str(constraint.sqltext):
                copy.constraints.remove(constraint)
    metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        department = Department(name='Test department', code='TEST')
        user = User(name='Test borrower', email='borrower@charusat.ac.in', role=RoleEnum.FACULTY)
        session.add_all([department, user])
        session.flush()
        lab = Lab(name='Test lab', code='TEST', department_id=department.id)
        session.add(lab)
        session.flush()
        model = EquipmentModel(name='Test equipment', category='MC', lab_id=lab.id)
        session.add(model)
        session.flush()
        unit = EquipmentUnit(asset_id='TEST-UNIT', model_id=model.id, lab_id=lab.id)
        session.add(unit)
        session.commit()
        db = SimpleNamespace(**{
            name: AsyncMock(side_effect=getattr(session, name))
            for name in ('execute', 'delete', 'flush', 'commit', 'rollback')
        })
        app = FastAPI()
        app.include_router(router)
        current = SimpleNamespace(id=user.id, role=RoleEnum.ADMIN)
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: current
        yield SimpleNamespace(app=app, session=session, db=db, model=model,
                              unit=unit, lab=lab, user=user, current=current)
    engine.dispose()


async def delete(fixture):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=fixture.app), base_url='http://test') as client:
        return await client.delete(f'/models/{fixture.model.id}')


@pytest.mark.asyncio
async def test_admin_deletes_model_and_units(inventory):
    response = await delete(inventory)
    assert response.status_code == 200, response.text
    assert inventory.session.execute(select(EquipmentModel)).scalars().all() == []
    assert inventory.session.execute(select(EquipmentUnit)).scalars().all() == []


@pytest.mark.parametrize('role', [RoleEnum.ASSISTANT, RoleEnum.FACULTY, RoleEnum.STUDENT])
@pytest.mark.asyncio
async def test_non_admin_cannot_delete(inventory, role):
    inventory.current.role = role
    assert (await delete(inventory)).status_code == 403
    inventory.db.delete.assert_not_awaited()


def add_request(fixture):
    request = Request(requester_id=fixture.user.id, model_id=fixture.model.id,
                      lab_id=fixture.lab.id, quantity=1, purpose='Test',
                      required_from=datetime.now(timezone.utc),
                      required_until=datetime.now(timezone.utc) + timedelta(days=1))
    fixture.session.add(request)
    fixture.session.commit()
    return request


@pytest.mark.asyncio
async def test_request_history_preserved(inventory):
    add_request(inventory)
    response = await delete(inventory)
    assert response.status_code == 409, response.text
    inventory.db.rollback.assert_awaited_once()
    assert inventory.session.get(EquipmentModel, inventory.model.id) is not None
    assert inventory.session.get(EquipmentUnit, 'TEST-UNIT') is not None


@pytest.mark.parametrize('status,expected', [(TransactionStatusEnum.ACTIVE, 400), (TransactionStatusEnum.RETURNED, 409)])
@pytest.mark.asyncio
async def test_borrowing_history_preserved(inventory, status, expected):
    request = add_request(inventory)
    loan = Transaction(request_id=request.id, unit_asset_id=inventory.unit.asset_id,
                       borrower_id=inventory.user.id, lab_id=inventory.lab.id, status=status,
                       due_date=datetime.now(timezone.utc) + timedelta(days=1),
                       return_date=datetime.now(timezone.utc) if status == TransactionStatusEnum.RETURNED else None)
    inventory.session.add(loan)
    inventory.session.commit()
    response = await delete(inventory)
    assert response.status_code == expected, response.text
    assert inventory.session.get(EquipmentUnit, 'TEST-UNIT') is not None
