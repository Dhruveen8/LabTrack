from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.api.endpoints import borrowing
from app.db.models import RoleEnum, RequestKindEnum, RequestStatusEnum
from app.schemas.borrowing import ExtensionRequest, RequestCreate


def test_deadline_is_end_of_selected_day_in_india():
    start = datetime.fromisoformat('2026-10-09T00:00:00+05:30')
    assert borrowing.quick_borrow_deadline(start, RoleEnum.FACULTY) == datetime(2026, 10, 9, 18, 29, 59, tzinfo=timezone.utc)


def test_utc_start_uses_indian_calendar_day():
    start = datetime(2026, 10, 9, 20, tzinfo=timezone.utc)
    assert borrowing.quick_borrow_deadline(start, RoleEnum.FACULTY) == datetime(2026, 10, 10, 18, 29, 59, tzinfo=timezone.utc)


@pytest.mark.parametrize('role', [RoleEnum.STUDENT, RoleEnum.ASSISTANT, RoleEnum.ADMIN])
def test_quick_borrow_is_faculty_only(role):
    with pytest.raises(HTTPException) as error:
        borrowing.quick_borrow_deadline(datetime.now(timezone.utc), role)
    assert error.value.status_code == 403


def test_same_day_requests_cannot_be_extended():
    result = MagicMock()
    result.scalars.return_value.first.return_value = SimpleNamespace(requester_id=5, kind=RequestKindEnum.QUICK_BORROW)
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    with pytest.raises(HTTPException, match='cannot be extended'):
        borrowing.request_extension(1, ExtensionRequest(new_due_date=datetime(2027, 1, 1, tzinfo=timezone.utc)), db, SimpleNamespace(id=5, role=RoleEnum.FACULTY)).send(None)


def test_quick_request_waits_for_assistant_and_overrides_long_deadline(monkeypatch):
    db = SimpleNamespace(get=AsyncMock(return_value=SimpleNamespace(id=20, lab_id=11)), commit=AsyncMock())
    request = SimpleNamespace(status=RequestStatusEnum.PENDING, lab_id=11,
                              required_until=datetime(2027, 1, 5, 18, 29, 59, tzinfo=timezone.utc))
    allocation = AsyncMock(return_value=request)
    monkeypatch.setattr(borrowing, 'allocate_request', allocation)
    monkeypatch.setattr(borrowing, 'request_response', AsyncMock(return_value=request))
    body = RequestCreate(model_id=20, required_from='2027-01-05T00:00:00+05:30', required_until='2027-01-20T00:00:00+05:30', kind=RequestKindEnum.QUICK_BORROW)
    with pytest.raises(StopIteration) as completed:
        borrowing.create_request(body, db, SimpleNamespace(id=5, role=RoleEnum.FACULTY)).send(None)
    request = completed.value.value
    assert request.status == RequestStatusEnum.PENDING
    assert request.lab_id == 11
    assert request.required_until == datetime(2027, 1, 5, 18, 29, 59, tzinfo=timezone.utc)
    assert allocation.call_args.args[4] == request.required_until
