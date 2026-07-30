from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from finance.models import LedgerEntry, Membership, MonthlyPeriod, SavingsGoal

pytestmark = pytest.mark.django_db


def test_end_to_end_monthly_finance_flow() -> None:
    owner = get_user_model().objects.create_user(
        username="owner@example.com",
        email="owner@example.com",
        first_name="Owner",
    )
    client = APIClient()
    client.force_authenticate(owner)

    onboarding = client.post(
        "/api/v1/onboarding/",
        {
            "household_name": "Our Home",
            "bank_name": "Main Bank",
            "opening_balance": "100000.00",
            "opening_date": date.today().isoformat(),
            "monthly_savings_target": "150000.00",
            "incomes": [{"name": "Salary", "amount": "500000.00"}],
            "expenses": [
                {
                    "name": "Rent",
                    "expected_amount": "100000.00",
                    "due_day": 1,
                    "reminder_lead_days": 3,
                },
                {
                    "name": "Utilities",
                    "expected_amount": "20000.00",
                    "due_day": 10,
                    "reminder_lead_days": 3,
                },
            ],
            "savings_goals": [
                {
                    "name": "Emergency fund",
                    "opening_balance": "0.00",
                    "target_amount": "1000000.00",
                }
            ],
        },
        format="json",
    )
    assert onboarding.status_code == 201

    period = MonthlyPeriod.objects.get(household__owner=owner)
    month = client.get("/api/v1/months/current/").data
    income = month["income_plans"][0]
    expenses = {item["name"]: item for item in month["planned_expenses"]}
    entry_date = date(period.year, period.month, 1).isoformat()

    assert (
        client.post(
            f"/api/v1/income-plans/{income['id']}/receive/",
            {"amount": "500000.00", "date": entry_date},
            format="json",
        ).status_code
        == 201
    )
    for name, amount in (("Rent", "40000.00"), ("Utilities", "20000.00")):
        assert (
            client.post(
                f"/api/v1/planned-expenses/{expenses[name]['id']}/payments/",
                {"amount": amount, "date": entry_date},
                format="json",
            ).status_code
            == 201
        )

    household = owner.finance_membership.household
    member = get_user_model().objects.create_user(
        username="member@example.com",
        email="member@example.com",
    )
    Membership.objects.create(
        user=member,
        household=household,
        role=Membership.Role.MEMBER,
    )
    client.force_authenticate(member)
    personal = client.post(
        "/api/v1/personal-expenses/",
        {
            "period": period.id,
            "date": entry_date,
            "amount": "10000.00",
            "description": "Private purchase",
        },
        format="json",
    )
    assert personal.status_code == 201

    client.force_authenticate(owner)
    goal = SavingsGoal.objects.get(household=household)
    saved = client.post(
        "/api/v1/savings-movements/",
        {
            "period": period.id,
            "kind": "contribution",
            "destination_goal": goal.id,
            "date": entry_date,
            "amount": "150000.00",
            "notes": "Monthly target",
        },
        format="json",
    )
    assert saved.status_code == 201

    dashboard = client.get(f"/api/v1/dashboard/?month={period.label}").data
    assert dashboard["period"]["household_paid"] == Decimal("60000.00")
    assert dashboard["period"]["personal_spent"] == Decimal("10000.00")
    assert dashboard["period"]["safe_to_spend"] == Decimal("220000.00")
    assert dashboard["period"]["net_cash_flow"] == Decimal("430000.00")
    assert dashboard["bank"]["calculated_balance"] == Decimal("530000.00")

    reconciled = client.post(
        "/api/v1/bank/reconciliations/",
        {
            "date": entry_date,
            "actual_balance": "535000.00",
            "notes": "Bank fee reversal",
            "post_adjustment": True,
        },
        format="json",
    )
    assert reconciled.status_code == 201
    assert reconciled.data["variance"] == "5000.00"
    assert LedgerEntry.objects.filter(entry_type=LedgerEntry.EntryType.ADJUSTMENT).count() == 1

    assert client.get("/api/v1/reports/trends/").status_code == 200
    assert client.get("/api/v1/exports/ledger.csv").status_code == 200
    backup = client.get("/api/v1/exports/backup.json")
    assert backup.status_code == 200
    assert b"Private purchase" in backup.content
