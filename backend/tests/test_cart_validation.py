from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.schemas.borrowing import CartQuantity, CartSubmit


@pytest.mark.parametrize('quantity', [0, -1, 501, 1.5, '2', True])
def test_cart_quantity_is_a_bounded_strict_integer(quantity):
    with pytest.raises(ValidationError):
        CartQuantity(quantity=quantity)


def body(items):
    return dict(items=items, required_from='2027-01-01T09:00:00+05:30',
                required_until='2027-01-02T09:00:00+05:30', purpose='Coursework', submission_key=str(uuid4()))


@pytest.mark.parametrize('items', [[], [{'model_id': 1, 'lab_id': 1, 'quantity': 1}] * 2,
                                  [{'model_id': 0, 'lab_id': 1, 'quantity': 1}],
                                  [{'model_id': 1, 'lab_id': 0, 'quantity': 1}]])
def test_empty_duplicate_or_invalid_cart_is_rejected(items):
    with pytest.raises(ValidationError):
        CartSubmit(**body(items))


def test_multiple_models_or_distinct_labs_are_accepted():
    parsed = CartSubmit(**body([dict(model_id=1, lab_id=1, quantity=1),
                               dict(model_id=2, lab_id=2, quantity=2)]))
    assert sum(item.quantity for item in parsed.items) == 3
