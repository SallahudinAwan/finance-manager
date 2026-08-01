from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from finance.models import (
    BankReconciliation,
    HouseholdInvitation,
    LedgerEntry,
    Membership,
    MonthlyPeriod,
    RecurringExpense,
    RecurringIncome,
    SavingsGoal,
    SavingsMovement,
)
from finance.services import (
    bank_calculated_balance,
    generate_month,
    period_summary,
    savings_goal_balance,
)
from finance.tests.factories import create_household, create_member

pytestmark = pytest.mark.django_db


def test_member_sees_only_own_personal_entries_but_dashboard_has_aggregate() -> None:
    owner, household = create_household()
    member = create_member(household)
    period = generate_month(household, 2026, 8)
    for user, amount, description in (
        (owner, Decimal("1000.00"), "Owner private"),
        (member, Decimal("2500.00"), "Member private"),
    ):
        LedgerEntry.objects.create(
            household=household,
            period=period,
            created_by=user,
            entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
            direction=LedgerEntry.Direction.DEBIT,
            date=date(2026, 8, 5),
            amount=amount,
            description=description,
        )

    client = APIClient()
    client.force_authenticate(member)
    own = client.get("/api/v1/personal-expenses/")
    dashboard = client.get("/api/v1/dashboard/?month=2026-08")

    assert own.status_code == 200
    assert len(own.data["results"]) == 1
    assert own.data["results"][0]["description"] == "Member private"
    assert dashboard.status_code == 200
    assert dashboard.data["period"]["personal_spent"] == Decimal("3500.00")
    assert "created_by" not in dashboard.data["period"]


def test_member_cannot_record_shared_payment() -> None:
    _, household = create_household()
    member = create_member(household)
    RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("38000.00"),
        due_day=1,
    )
    planned = generate_month(household, 2026, 8).planned_expenses.get()
    client = APIClient()
    client.force_authenticate(member)

    response = client.post(
        f"/api/v1/planned-expenses/{planned.id}/payments/",
        {"amount": "38000.00", "date": "2026-08-01"},
        format="json",
    )

    assert response.status_code == 403
    assert household.ledger_entries.count() == 0


def test_owner_template_edits_update_only_the_latest_month_snapshot() -> None:
    owner, household = create_household()
    income = RecurringIncome.objects.create(
        household=household,
        name="Salary",
        amount=Decimal("500000.00"),
    )
    bill = RecurringExpense.objects.create(
        household=household,
        name="Electricity",
        expected_amount=Decimal("5000.00"),
        due_day=10,
    )
    january = generate_month(household, 2026, 1)
    february = generate_month(household, 2026, 2)
    client = APIClient()
    client.force_authenticate(owner)

    income_response = client.patch(
        f"/api/v1/income-templates/{income.id}/",
        {"name": "Main salary", "amount": "525000.00"},
        format="json",
    )
    expense_response = client.patch(
        f"/api/v1/expense-templates/{bill.id}/",
        {
            "name": "Power bill",
            "expected_amount": "6500.00",
            "due_day": 31,
            "reminder_lead_days": 5,
        },
        format="json",
    )

    january_income = january.income_plans.get(template=income)
    february_income = february.income_plans.get(template=income)
    january_bill = january.planned_expenses.get(template=bill)
    february_bill = february.planned_expenses.get(template=bill)
    assert income_response.status_code == 200
    assert expense_response.status_code == 200
    assert (january_income.name, january_income.planned_amount) == (
        "Salary",
        Decimal("500000.00"),
    )
    assert (february_income.name, february_income.planned_amount) == (
        "Main salary",
        Decimal("525000.00"),
    )
    assert (january_bill.name, january_bill.expected_amount, january_bill.due_date) == (
        "Electricity",
        Decimal("5000.00"),
        date(2026, 1, 10),
    )
    assert (
        february_bill.name,
        february_bill.expected_amount,
        february_bill.due_date,
        february_bill.reminder_lead_days,
    ) == ("Power bill", Decimal("6500.00"), date(2026, 2, 28), 5)


def test_member_cannot_edit_recurring_plan_templates() -> None:
    _, household = create_household()
    member = create_member(household)
    income = RecurringIncome.objects.create(
        household=household,
        name="Salary",
        amount=Decimal("500000.00"),
    )
    bill = RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("38000.00"),
        due_day=1,
    )
    client = APIClient()
    client.force_authenticate(member)

    income_response = client.patch(
        f"/api/v1/income-templates/{income.id}/",
        {"amount": "1.00"},
        format="json",
    )
    expense_response = client.patch(
        f"/api/v1/expense-templates/{bill.id}/",
        {"expected_amount": "1.00"},
        format="json",
    )

    income.refresh_from_db()
    bill.refresh_from_db()
    assert income_response.status_code == 403
    assert expense_response.status_code == 403
    assert income.amount == Decimal("500000.00")
    assert bill.expected_amount == Decimal("38000.00")


def test_owner_can_edit_a_shared_transaction_without_reclassifying_it() -> None:
    owner, household = create_household()
    RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("38000.00"),
        due_day=1,
    )
    planned = generate_month(household, 2026, 8).planned_expenses.get()
    client = APIClient()
    client.force_authenticate(owner)
    created = client.post(
        f"/api/v1/planned-expenses/{planned.id}/payments/",
        {"amount": "18000.00", "date": "2026-08-01", "notes": "First transfer"},
        format="json",
    )

    updated = client.patch(
        f"/api/v1/ledger/{created.data['id']}/",
        {"amount": "20000.00", "date": "2026-08-02", "notes": "Corrected transfer"},
        format="json",
    )
    reclassified = client.patch(
        f"/api/v1/ledger/{created.data['id']}/",
        {"entry_type": LedgerEntry.EntryType.PERSONAL_EXPENSE},
        format="json",
    )
    outside_month = client.patch(
        f"/api/v1/ledger/{created.data['id']}/",
        {"date": "2026-09-01"},
        format="json",
    )

    assert updated.status_code == 200
    assert updated.data["amount"] == "20000.00"
    assert updated.data["notes"] == "Corrected transfer"
    assert planned.payment_status == "partial"
    assert reclassified.status_code == 400
    assert outside_month.status_code == 400


def test_owner_can_delete_a_shared_payment_and_restore_the_bill_balance() -> None:
    owner, household = create_household()
    RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("38000.00"),
        due_day=1,
    )
    planned = generate_month(household, 2026, 8).planned_expenses.get()
    client = APIClient()
    client.force_authenticate(owner)
    created = client.post(
        f"/api/v1/planned-expenses/{planned.id}/payments/",
        {"amount": "18000.00", "date": "2026-08-01"},
        format="json",
    )

    deleted = client.delete(f"/api/v1/ledger/{created.data['id']}/")

    planned.refresh_from_db()
    assert deleted.status_code == 204
    assert planned.paid_amount == Decimal("0.00")
    assert planned.remaining_amount == Decimal("38000.00")
    assert planned.payment_status == "unpaid"


def test_historical_payment_edits_and_deletion_recalculate_next_month_credit() -> None:
    owner, household = create_household()
    RecurringExpense.objects.create(
        household=household,
        name="Electricity",
        expected_amount=Decimal("5000.00"),
        due_day=10,
    )
    july = generate_month(household, 2026, 7)
    june = generate_month(household, 2026, 6)
    june_bill = june.planned_expenses.get()
    july_bill = july.planned_expenses.get()
    client = APIClient()
    client.force_authenticate(owner)

    created = client.post(
        f"/api/v1/planned-expenses/{june_bill.id}/payments/",
        {"amount": "7000.00", "date": "2026-06-10"},
        format="json",
    )
    july_bill.refresh_from_db()
    assert created.status_code == 201
    assert july_bill.carryover_credit == Decimal("2000.00")

    updated = client.patch(
        f"/api/v1/ledger/{created.data['id']}/",
        {"amount": "8000.00"},
        format="json",
    )
    july_bill.refresh_from_db()
    assert updated.status_code == 200
    assert july_bill.carryover_credit == Decimal("3000.00")

    deleted = client.delete(f"/api/v1/ledger/{created.data['id']}/")
    july_bill.refresh_from_db()
    assert deleted.status_code == 204
    assert july_bill.carryover_credit == Decimal("0.00")
    assert july_bill.remaining_amount == Decimal("5000.00")


def test_owner_can_manually_create_and_populate_a_previous_month() -> None:
    owner, household = create_household()
    RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("38000.00"),
        due_day=1,
    )
    goal = SavingsGoal.objects.create(household=household, name="Emergency")
    client = APIClient()
    client.force_authenticate(owner)

    generated = client.post(
        "/api/v1/months/generate/",
        {"year": 2026, "month": 6},
        format="json",
    )
    period_id = generated.data["id"]
    personal = client.post(
        "/api/v1/personal-expenses/",
        {
            "period": period_id,
            "date": "2026-06-12",
            "amount": "2500.00",
            "description": "Historical personal expense",
        },
        format="json",
    )
    savings = client.post(
        "/api/v1/savings-movements/",
        {
            "period": period_id,
            "kind": "contribution",
            "source_goal": None,
            "destination_goal": goal.id,
            "date": "2026-06-25",
            "amount": "10000.00",
            "notes": "June allocation",
        },
        format="json",
    )

    assert generated.status_code == 201
    assert generated.data["label"] == "2026-06"
    assert generated.data["planned_expenses"][0]["remaining_amount"] == Decimal("38000.00")
    assert personal.status_code == 201
    assert savings.status_code == 201


def test_new_month_moves_bill_and_safe_to_spend_leftovers_without_changing_bank() -> None:
    owner, household = create_household()
    household.monthly_savings_target = Decimal("0.00")
    household.save(update_fields=["monthly_savings_target", "updated_at"])
    income_template = RecurringIncome.objects.create(
        household=household,
        name="Salary",
        amount=Decimal("100000.00"),
    )
    RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("30000.00"),
        due_day=1,
    )
    bill_goal = SavingsGoal.objects.create(household=household, name="Others")
    personal_goal = SavingsGoal.objects.create(household=household, name="Leftovers")
    july = generate_month(household, 2026, 7)
    income_plan = july.income_plans.get(template=income_template)
    rent = july.planned_expenses.get()
    LedgerEntry.objects.create(
        household=household,
        period=july,
        planned_income=income_plan,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.INCOME,
        direction=LedgerEntry.Direction.CREDIT,
        date=date(2026, 7, 1),
        amount=Decimal("100000.00"),
        description="Salary",
    )
    rent_payment = LedgerEntry.objects.create(
        household=household,
        period=july,
        planned_expense=rent,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.HOUSEHOLD_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 7, 2),
        amount=Decimal("20000.00"),
        description="Rent",
    )
    personal_expense = LedgerEntry.objects.create(
        household=household,
        period=july,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 7, 3),
        amount=Decimal("10000.00"),
        description="Personal spending",
    )
    client = APIClient()
    client.force_authenticate(owner)

    preview = client.get("/api/v1/months/rollover-preview/?year=2026&month=8")
    bank_before = bank_calculated_balance(household.bank_account)
    payload = {
        "year": 2026,
        "month": 8,
        "rollover": {
            "bill_allocations": [{"planned_expense": rent.id, "destination_goal": bill_goal.id}],
            "safe_to_spend": {
                "action": "savings",
                "destination_goal": personal_goal.id,
            },
        },
    }
    created = client.post("/api/v1/months/generate/", payload, format="json")
    repeated = client.post("/api/v1/months/generate/", payload, format="json")

    assert preview.status_code == 200
    assert preview.data["source_month"] == "2026-07"
    assert preview.data["unpaid_expenses"] == [
        {"id": rent.id, "name": "Rent", "remaining_amount": Decimal("10000.00")}
    ]
    assert preview.data["safe_to_spend"] == Decimal("60000.00")
    assert created.status_code == 201
    assert repeated.status_code == 201
    assert savings_goal_balance(bill_goal) == Decimal("10000.00")
    assert savings_goal_balance(personal_goal) == Decimal("60000.00")
    assert household.rollover_allocations.count() == 2
    assert household.savings_movements.filter(kind="allocation").count() == 2
    assert bank_calculated_balance(household.bank_account) == bank_before
    assert period_summary(july)["safe_to_spend"] == Decimal("0.00")

    payment_update = client.patch(
        f"/api/v1/ledger/{rent_payment.id}/",
        {"amount": "25000.00"},
        format="json",
    )
    personal_update = client.patch(
        f"/api/v1/personal-expenses/{personal_expense.id}/",
        {"amount": "15000.00"},
        format="json",
    )
    assert payment_update.status_code == 200
    assert personal_update.status_code == 200
    assert savings_goal_balance(bill_goal) == Decimal("5000.00")
    assert savings_goal_balance(personal_goal) == Decimal("55000.00")

    deleted = client.delete(f"/api/v1/months/{created.data['id']}/")
    assert deleted.status_code == 204
    assert savings_goal_balance(bill_goal) == Decimal("0.00")
    assert savings_goal_balance(personal_goal) == Decimal("0.00")
    assert household.rollover_allocations.count() == 0


def test_new_month_allocates_fixed_savings_to_a_goal_without_changing_bank() -> None:
    owner, household = create_household()
    income_template = RecurringIncome.objects.create(
        household=household,
        name="Salary",
        amount=Decimal("500000.00"),
    )
    goal = SavingsGoal.objects.create(household=household, name="Emergency")
    client = APIClient()
    client.force_authenticate(owner)
    bank_before = bank_calculated_balance(household.bank_account)

    preview = client.get("/api/v1/months/rollover-preview/?year=2026&month=8")
    payload = {
        "year": 2026,
        "month": 8,
        "rollover": {
            "bill_allocations": [],
            "safe_to_spend": None,
            "fixed_savings_goal": goal.id,
        },
    }
    created = client.post("/api/v1/months/generate/", payload, format="json")
    repeated = client.post("/api/v1/months/generate/", payload, format="json")

    period = household.periods.get(year=2026, month=8)
    allocation = household.rollover_allocations.get(source_kind="fixed_savings")
    movement = allocation.savings_movement
    assert preview.status_code == 200
    assert preview.data["fixed_savings_target"] == Decimal("150000.00")
    assert created.status_code == 201
    assert repeated.status_code == 201
    assert allocation.source_period == period
    assert allocation.destination_period == period
    assert allocation.destination_goal == goal
    assert movement.kind == SavingsMovement.Kind.ALLOCATION
    assert movement.amount == Decimal("150000.00")
    assert savings_goal_balance(goal) == Decimal("150000.00")
    assert period_summary(period)["net_new_savings"] == Decimal("150000.00")
    assert bank_calculated_balance(household.bank_account) == bank_before
    assert household.rollover_allocations.filter(source_kind="fixed_savings").count() == 1

    LedgerEntry.objects.create(
        household=household,
        period=period,
        planned_income=period.income_plans.get(template=income_template),
        created_by=owner,
        entry_type=LedgerEntry.EntryType.INCOME,
        direction=LedgerEntry.Direction.CREDIT,
        date=date(2026, 8, 1),
        amount=Decimal("500000.00"),
        description="Salary",
    )
    assert period_summary(period)["safe_to_spend"] == Decimal("350000.00")

    protected = client.delete(f"/api/v1/savings-movements/{movement.id}/")
    assert protected.status_code == 400
    assert savings_goal_balance(goal) == Decimal("150000.00")


def test_safe_to_spend_can_carry_into_the_next_month_without_changing_bank() -> None:
    owner, household = create_household()
    household.monthly_savings_target = Decimal("0.00")
    household.save(update_fields=["monthly_savings_target", "updated_at"])
    income_template = RecurringIncome.objects.create(
        household=household,
        name="Salary",
        amount=Decimal("100000.00"),
    )
    RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("30000.00"),
        due_day=1,
    )
    july = generate_month(household, 2026, 7)
    LedgerEntry.objects.create(
        household=household,
        period=july,
        planned_income=july.income_plans.get(template=income_template),
        created_by=owner,
        entry_type=LedgerEntry.EntryType.INCOME,
        direction=LedgerEntry.Direction.CREDIT,
        date=date(2026, 7, 1),
        amount=Decimal("100000.00"),
        description="Salary",
    )
    rent = july.planned_expenses.get()
    LedgerEntry.objects.create(
        household=household,
        period=july,
        planned_expense=rent,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.HOUSEHOLD_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 7, 2),
        amount=Decimal("30000.00"),
        description="Rent",
    )
    LedgerEntry.objects.create(
        household=household,
        period=july,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 7, 3),
        amount=Decimal("10000.00"),
        description="Personal spending",
    )
    client = APIClient()
    client.force_authenticate(owner)
    bank_before = bank_calculated_balance(household.bank_account)

    response = client.post(
        "/api/v1/months/generate/",
        {
            "year": 2026,
            "month": 8,
            "rollover": {
                "bill_allocations": [],
                "safe_to_spend": {"action": "carryover"},
            },
        },
        format="json",
    )

    august = household.periods.get(year=2026, month=8)
    august_summary = period_summary(august)
    assert response.status_code == 201
    assert response.data["safe_to_spend_carryover"] == Decimal("60000.00")
    assert august_summary["safe_to_spend_carryover"] == Decimal("60000.00")
    assert august_summary["safe_to_spend"] == Decimal("30000.00")
    assert bank_calculated_balance(household.bank_account) == bank_before
    assert household.savings_movements.filter(kind="allocation").count() == 0


def test_owner_can_delete_a_complete_month_and_later_carryovers_recalculate() -> None:
    owner, household = create_household()
    template = RecurringExpense.objects.create(
        household=household,
        name="Electricity",
        expected_amount=Decimal("5000.00"),
        due_day=10,
    )
    goal = SavingsGoal.objects.create(household=household, name="Emergency")
    july = generate_month(household, 2026, 7)
    june = generate_month(household, 2026, 6)
    june_bill = june.planned_expenses.get()
    july_bill = july.planned_expenses.get()
    SavingsMovement.objects.create(
        household=household,
        period=june,
        created_by=owner,
        kind=SavingsMovement.Kind.CONTRIBUTION,
        destination_goal=goal,
        date=date(2026, 6, 25),
        amount=Decimal("10000.00"),
    )
    BankReconciliation.objects.create(
        account=household.bank_account,
        created_by=owner,
        date=date(2026, 6, 30),
        actual_balance=Decimal("322980.00"),
        calculated_balance=Decimal("322980.00"),
        variance=Decimal("0.00"),
    )
    client = APIClient()
    client.force_authenticate(owner)
    payment = client.post(
        f"/api/v1/planned-expenses/{june_bill.id}/payments/",
        {"amount": "7000.00", "date": "2026-06-10"},
        format="json",
    )
    client.post(
        "/api/v1/personal-expenses/",
        {
            "period": june.id,
            "date": "2026-06-12",
            "amount": "2500.00",
            "description": "June private expense",
        },
        format="json",
    )
    july_bill.refresh_from_db()
    assert payment.status_code == 201
    assert july_bill.carryover_credit == Decimal("2000.00")

    response = client.delete(f"/api/v1/months/{june.id}/")

    july_bill.refresh_from_db()
    assert response.status_code == 204
    deleted_period = MonthlyPeriod.objects.get(id=june.id)
    assert deleted_period.is_deleted is True
    assert not LedgerEntry.objects.filter(period_id=june.id).exists()
    assert not SavingsMovement.objects.filter(period_id=june.id).exists()
    assert not BankReconciliation.objects.filter(date=date(2026, 6, 30)).exists()
    assert july_bill.carryover_credit == Decimal("0.00")
    assert SavingsGoal.objects.filter(id=goal.id).exists()
    assert RecurringExpense.objects.filter(id=template.id).exists()
    audit = household.audit_events.get(action="month_deleted")
    assert audit.metadata["month"] == "2026-06"
    assert audit.metadata["ledger_entries"] == 2
    listed = client.get("/api/v1/months/")
    assert listed.status_code == 200
    assert all(item["label"] != "2026-06" for item in listed.data["results"])
    hidden = client.get("/api/v1/months/by-label/?month=2026-06")
    deleted_period.refresh_from_db()
    assert hidden.status_code == 404
    assert deleted_period.is_deleted is True

    restored = client.post(
        "/api/v1/months/generate/",
        {"year": 2026, "month": 6},
        format="json",
    )
    deleted_period.refresh_from_db()
    assert restored.status_code == 201
    assert restored.data["id"] == june.id
    assert deleted_period.is_deleted is False
    assert deleted_period.planned_expenses.count() == 1


def test_member_cannot_delete_a_month_or_another_households_month() -> None:
    owner, household = create_household()
    member = create_member(household)
    period = generate_month(household, 2026, 6)
    other_owner, _ = create_household("other-owner@example.com")
    client = APIClient()

    client.force_authenticate(member)
    member_response = client.delete(f"/api/v1/months/{period.id}/")
    client.force_authenticate(other_owner)
    other_household_response = client.delete(f"/api/v1/months/{period.id}/")

    assert member_response.status_code == 403
    assert other_household_response.status_code == 404
    assert MonthlyPeriod.objects.filter(id=period.id).exists()


def test_personal_transaction_edits_remain_private_to_the_creator() -> None:
    owner, household = create_household()
    member = create_member(household)
    period = generate_month(household, 2026, 8)
    private_entry = LedgerEntry.objects.create(
        household=household,
        period=period,
        created_by=member,
        entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 8, 5),
        amount=Decimal("2500.00"),
        description="Lunch",
    )
    client = APIClient()
    client.force_authenticate(member)

    updated = client.patch(
        f"/api/v1/personal-expenses/{private_entry.id}/",
        {
            "description": "Lunch with friends",
            "amount": "3000.00",
            "date": "2026-08-06",
            "notes": "Corrected receipt",
        },
        format="json",
    )
    client.force_authenticate(owner)
    owner_edit = client.patch(
        f"/api/v1/personal-expenses/{private_entry.id}/",
        {"amount": "1.00"},
        format="json",
    )
    shared_ledger = client.get(f"/api/v1/ledger/?period={period.id}")

    assert updated.status_code == 200
    assert updated.data["description"] == "Lunch with friends"
    assert updated.data["amount"] == "3000.00"
    assert owner_edit.status_code == 404
    assert shared_ledger.status_code == 200
    assert shared_ledger.data["results"] == []


def test_personal_transaction_deletion_remains_private_to_the_creator() -> None:
    owner, household = create_household()
    member = create_member(household)
    other_member = create_member(household, "other@example.com")
    period = generate_month(household, 2026, 8)
    private_entry = LedgerEntry.objects.create(
        household=household,
        period=period,
        created_by=member,
        entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 8, 5),
        amount=Decimal("2500.00"),
        description="Lunch",
    )
    client = APIClient()
    client.force_authenticate(other_member)
    other_delete = client.delete(f"/api/v1/personal-expenses/{private_entry.id}/")
    client.force_authenticate(owner)
    owner_delete = client.delete(f"/api/v1/ledger/{private_entry.id}/")
    client.force_authenticate(member)
    creator_delete = client.delete(f"/api/v1/personal-expenses/{private_entry.id}/")

    assert other_delete.status_code == 404
    assert owner_delete.status_code == 404
    assert creator_delete.status_code == 204
    assert not LedgerEntry.objects.filter(id=private_entry.id).exists()


def test_owner_backup_contains_private_entries_and_records_audit() -> None:
    owner, household = create_household()
    member = create_member(household)
    period = generate_month(household, 2026, 8)
    LedgerEntry.objects.create(
        household=household,
        period=period,
        created_by=member,
        entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 8, 5),
        amount=Decimal("2500.00"),
        description="Private item",
    )
    client = APIClient()
    client.force_authenticate(owner)

    response = client.get("/api/v1/exports/backup.json")

    assert response.status_code == 200
    assert b"Private item" in response.content
    assert household.audit_events.filter(action="data_export").exists()


def test_cross_household_object_ids_are_rejected() -> None:
    owner_a, _ = create_household("a@example.com")
    _, household_b = create_household("b@example.com")
    period_b = generate_month(household_b, 2026, 8)
    client = APIClient()
    client.force_authenticate(owner_a)

    response = client.post(
        "/api/v1/personal-expenses/",
        {
            "period": period_b.id,
            "date": "2026-08-01",
            "amount": "10.00",
            "description": "Nope",
        },
        format="json",
    )

    assert response.status_code == 400


def test_invitation_requires_matching_email_and_an_unattached_account() -> None:
    owner, household = create_household()
    invitation = HouseholdInvitation.objects.create(
        household=household,
        email="invited@example.com",
        expires_at="2026-09-01T00:00:00Z",
        invited_by=owner,
    )
    wrong_user = get_user_model().objects.create_user(
        username="wrong@example.com",
        email="wrong@example.com",
    )
    client = APIClient()
    client.force_authenticate(wrong_user)

    response = client.post(f"/api/v1/invitations/{invitation.token}/accept/")

    assert response.status_code == 403
    assert not hasattr(wrong_user, "finance_membership")


def test_expired_invitation_is_rejected_and_marked_expired() -> None:
    owner, household = create_household()
    invited = get_user_model().objects.create_user(
        username="invited@example.com",
        email="invited@example.com",
    )
    invitation = HouseholdInvitation.objects.create(
        household=household,
        email=invited.email,
        expires_at=timezone.now() - timedelta(minutes=1),
        invited_by=owner,
    )
    client = APIClient()
    client.force_authenticate(invited)

    response = client.post(f"/api/v1/invitations/{invitation.token}/accept/")

    assert response.status_code == 410
    invitation.refresh_from_db()
    assert invitation.status == HouseholdInvitation.Status.EXPIRED


def test_existing_household_member_cannot_accept_another_invitation() -> None:
    _, household_a = create_household("a@example.com")
    member = create_member(household_a, "member@example.com")
    owner_b, household_b = create_household("b@example.com")
    invitation = HouseholdInvitation.objects.create(
        household=household_b,
        email=member.email,
        expires_at=timezone.now() + timedelta(days=1),
        invited_by=owner_b,
    )
    client = APIClient()
    client.force_authenticate(member)

    response = client.post(f"/api/v1/invitations/{invitation.token}/accept/")

    assert response.status_code == 409
    assert member.finance_membership.household == household_a


def test_owner_can_transfer_ownership_and_former_owner_can_leave() -> None:
    owner, household = create_household()
    member = create_member(household)
    member_membership = member.finance_membership
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        "/api/v1/household/transfer-ownership/",
        {"membership_id": member_membership.id},
        format="json",
    )

    assert response.status_code == 200
    household.refresh_from_db()
    owner.finance_membership.refresh_from_db()
    member_membership.refresh_from_db()
    assert household.owner == member
    assert owner.finance_membership.role == Membership.Role.MEMBER
    assert member_membership.role == Membership.Role.OWNER

    leave = client.post("/api/v1/household/leave/")
    assert leave.status_code == 204
    assert not Membership.objects.filter(user=owner).exists()


def test_owner_with_members_must_transfer_before_account_deletion() -> None:
    owner, household = create_household()
    create_member(household)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.delete("/api/v1/account/")

    assert response.status_code == 409
    assert get_user_model().objects.filter(pk=owner.pk).exists()


def test_savings_withdrawal_cannot_overdraw_goal() -> None:
    owner, household = create_household()
    period = generate_month(household, 2026, 8)
    goal = SavingsGoal.objects.create(
        household=household,
        name="Emergency",
        opening_balance=Decimal("5000.00"),
    )
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        "/api/v1/savings-movements/",
        {
            "period": period.id,
            "kind": "withdrawal",
            "source_goal": goal.id,
            "date": "2026-08-01",
            "amount": "5000.01",
        },
        format="json",
    )

    assert response.status_code == 400
    assert household.savings_movements.count() == 0
