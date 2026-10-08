"""Event request/assistant allocation regressions without a live database."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.api.endpoints import events
from app.db.models import AccountStatusEnum, RoleEnum, UnitStatusEnum


def body(**changes):
    return dict(event_name='Robotics Club', purpose='Workshop',
                due_date=datetime.now(timezone.utc) + timedelta(days=7), lab_id=10,
                requested_items=[{'model_id': 20, 'quantity': 2}], **changes)


@pytest.mark.parametrize('changes', [
    {'requested_items': []}, {'lab_id': None},
    {'requested_items': [{'model_id': 20, 'quantity': 0}]},
    {'requested_items': [{'model_id': 20, 'quantity': 1.5}]},
    {'requested_items': [{'model_id': 20, 'quantity': 1}, {'model_id': 20, 'quantity': 1}]},
    {'requested_items': [{'model_id': 20, 'quantity': 600}, {'model_id': 21, 'quantity': 600}]},
    {'unit_asset_ids': ['ASSET-A']},
])
def test_invalid_requests(changes):
    values = body()
    values.update(changes)
    with pytest.raises(ValidationError):
        events.EventRequestCreate(**values)


def result(value=None, rows=None):
    response = MagicMock()
    response.scalar_one.return_value = value
    response.scalar_one_or_none.return_value = value
    response.scalars.return_value.all.return_value = rows or []
    return response


def database():
    return SimpleNamespace(get=AsyncMock(), execute=AsyncMock(), add=MagicMock(),
                           flush=AsyncMock(), commit=AsyncMock(), rollback=AsyncMock())


@pytest.mark.asyncio
async def test_submission_defers_physical_allocation(monkeypatch):
    db = database()
    db.get.side_effect = [SimpleNamespace(lab_id=10, name='Arduino'),
                          SimpleNamespace(account_status=AccountStatusEnum.ACTIVE)]
    db.execute.side_effect = [result(3), result(7)]
    notification = AsyncMock()
    monkeypatch.setattr(events, 'create_notification', notification)
    faculty = SimpleNamespace(id=5, name='Faculty')
    request = await events.submit_request(events.EventRequestCreate(**body()), db, faculty)
    assert request.unit_asset_ids == []
    assert request.requested_items == [{'model_id': 20, 'quantity': 2}]
    assert request.lab_id == 10 and request.coordinator_id == 5
    assert '2 units' in notification.call_args.args[3]
    db.commit.assert_awaited_once()


@pytest.mark.parametrize('lab,available', [(11, 3), (10, 1)])
@pytest.mark.asyncio
async def test_submission_rejects_foreign_models_and_insufficient_stock(lab, available):
    db = database()
    db.get.return_value = SimpleNamespace(lab_id=lab, name='Arduino')
    db.execute.return_value = result(available)
    with pytest.raises(HTTPException) as failure:
        await events.submit_request(events.EventRequestCreate(**body()), db, SimpleNamespace(id=5))
    assert failure.value.status_code == 400
    db.add.assert_not_called()
    db.commit.assert_not_awaited()


def request_row():
    return SimpleNamespace(id=1, status='PENDING', lab_id=10, coordinator_id=5,
                           event_name='Robotics Club', purpose='Workshop', due_date=body()['due_date'],
                           requested_items=[{'model_id': 20, 'quantity': 2}], unit_asset_ids=[])


def unit(asset, model=20, lab=10):
    return SimpleNamespace(asset_id=asset, model_id=model, lab_id=lab, status=UnitStatusEnum.AVAILABLE)


@pytest.fixture
def approval(monkeypatch):
    db = database()
    request = request_row()
    db.execute.side_effect = [result(request), result(rows=[unit('A'), unit('B')])]
    monkeypatch.setattr(events, 'get_assistant_labs', AsyncMock(return_value=[10]))
    issue = AsyncMock(return_value=SimpleNamespace(id=99))
    monkeypatch.setattr(events, 'issue_approved_event', issue)
    return db, request, issue


@pytest.mark.asyncio
async def test_assistant_allocates_exact_units(approval):
    db, request, issue = approval
    response = await events.approve(1, events.Allocation(unit_asset_ids=['A', 'B']), db, SimpleNamespace(id=7))
    assert response.status == 'APPROVED' and response.event_issue_id == 99
    assert response.unit_asset_ids == ['A', 'B'] and response.decided_by_id == 7
    assert issue.call_args.args[0].unit_asset_ids == ['A', 'B']
    db.commit.assert_awaited_once()


@pytest.mark.parametrize('units', [[unit('A')], [unit('A'), unit('B', model=21)],
                                 [unit('A'), unit('B', lab=11)]])
@pytest.mark.asyncio
async def test_bad_allocation_never_issues(approval, units):
    db, request, issue = approval
    db.execute.side_effect = [result(request), result(rows=units)]
    with pytest.raises(HTTPException) as failure:
        await events.approve(1, events.Allocation(unit_asset_ids=['A', 'B']), db, SimpleNamespace(id=7))
    assert failure.value.status_code == 400 and request.status == 'PENDING'
    issue.assert_not_awaited()
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_allocation_never_issues(approval):
    db, request, issue = approval
    with pytest.raises(HTTPException) as failure:
        await events.approve(1, None, db, SimpleNamespace(id=7))
    assert failure.value.status_code == 400
    issue.assert_not_awaited()


def test_duplicate_allocation_rejected():
    with pytest.raises(ValidationError):
        events.Allocation(unit_asset_ids=['A', ' A '])


@pytest.mark.asyncio
async def test_repeat_approval_rejected(approval):
    db, request, issue = approval
    request.status = 'APPROVED'
    with pytest.raises(HTTPException) as failure:
        await events.approve(1, events.Allocation(unit_asset_ids=['A', 'B']), db, SimpleNamespace(id=7))
    assert failure.value.status_code == 409
    issue.assert_not_awaited()


@pytest.mark.asyncio
async def test_unassigned_assistant_rejected(approval, monkeypatch):
    db, request, issue = approval
    monkeypatch.setattr(events, 'get_assistant_labs', AsyncMock(return_value=[11]))
    with pytest.raises(HTTPException) as failure:
        await events.approve(1, events.Allocation(unit_asset_ids=['A', 'B']), db, SimpleNamespace(id=8))
    assert failure.value.status_code == 403
    issue.assert_not_awaited()


@pytest.mark.asyncio
async def test_changed_availability_rolls_back(approval):
    db, request, issue = approval
    issue.side_effect = IntegrityError('issue', {}, Exception('conflict'))
    with pytest.raises(HTTPException) as failure:
        await events.approve(1, events.Allocation(unit_asset_ids=['A', 'B']), db, SimpleNamespace(id=7))
    assert failure.value.status_code == 409
    db.rollback.assert_awaited_once()
    db.commit.assert_not_awaited()
