from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from finance.models import SavingsGoal
from finance.tests.factories import create_household, create_member

pytestmark = pytest.mark.django_db


def test_owner_can_edit_a_savings_goal() -> None:
    owner, household = create_household()
    goal = SavingsGoal.objects.create(
        household=household,
        name="Emergency",
        opening_balance=Decimal("10000.00"),
        target_amount=Decimal("100000.00"),
    )
    client = APIClient()
    client.force_authenticate(owner)

    response = client.patch(
        f"/api/v1/savings-goals/{goal.id}/",
        {
            "name": "Emergency fund",
            "target_amount": "150000.00",
            "active": False,
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["name"] == "Emergency fund"
    assert response.data["opening_balance"] == Decimal("10000.00")
    assert response.data["target_amount"] == Decimal("150000.00")
    assert response.data["balance"] == Decimal("10000.00")
    assert response.data["active"] is False


def test_savings_goal_edits_validate_ownership_amounts_and_unique_names() -> None:
    owner, household = create_household()
    member = create_member(household)
    goal = SavingsGoal.objects.create(household=household, name="Emergency")
    SavingsGoal.objects.create(household=household, name="Travel")

    owner_client = APIClient()
    owner_client.force_authenticate(owner)
    duplicate = owner_client.patch(
        f"/api/v1/savings-goals/{goal.id}/",
        {"name": "Travel"},
        format="json",
    )
    negative = owner_client.patch(
        f"/api/v1/savings-goals/{goal.id}/",
        {"opening_balance": "-1.00"},
        format="json",
    )

    member_client = APIClient()
    member_client.force_authenticate(member)
    forbidden = member_client.patch(
        f"/api/v1/savings-goals/{goal.id}/",
        {"name": "Member edit"},
        format="json",
    )

    assert duplicate.status_code == 400
    assert negative.status_code == 400
    assert forbidden.status_code == 403
