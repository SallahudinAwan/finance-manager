from datetime import date
from decimal import Decimal

import pytest

from finance.models import (
    LedgerEntry,
    RecurringExpense,
    RecurringIncome,
    SavingsGoal,
    SavingsMovement,
)
from finance.services import (
    bank_calculated_balance,
    dashboard_data,
    generate_month,
    reconcile_bank,
    refresh_expense_carryovers,
    savings_goal_balance,
)
from finance.tests.factories import create_household

pytestmark = pytest.mark.django_db


def test_month_generation_is_idempotent_and_clamps_due_day() -> None:
    _, household = create_household()
    RecurringIncome.objects.create(household=household, name="Salary", amount=Decimal("500000.00"))
    RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("38000.00"),
        due_day=31,
    )

    first = generate_month(household, 2026, 2)
    second = generate_month(household, 2026, 2)

    assert first.pk == second.pk
    assert first.income_plans.count() == 1
    assert first.planned_expenses.count() == 1
    assert first.planned_expenses.get().due_date == date(2026, 2, 28)


def test_dashboard_calculations_match_budget_and_bank_rules() -> None:
    owner, household = create_household()
    RecurringIncome.objects.create(household=household, name="Salary", amount=Decimal("500000.00"))
    RecurringExpense.objects.create(
        household=household,
        name="Rent",
        expected_amount=Decimal("38000.00"),
        due_day=1,
    )
    RecurringExpense.objects.create(
        household=household,
        name="Utilities",
        expected_amount=Decimal("24000.00"),
        due_day=10,
    )
    goal = SavingsGoal.objects.create(household=household, name="General")
    period = generate_month(household, 2026, 8)
    salary = period.income_plans.get(name="Salary")
    rent = period.planned_expenses.get(name="Rent")

    LedgerEntry.objects.create(
        household=household,
        period=period,
        planned_income=salary,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.INCOME,
        direction=LedgerEntry.Direction.CREDIT,
        date=date(2026, 8, 1),
        amount=Decimal("500000.00"),
        description="Salary",
    )
    LedgerEntry.objects.create(
        household=household,
        period=period,
        planned_expense=rent,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.HOUSEHOLD_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 8, 2),
        amount=Decimal("38000.00"),
        description="Rent",
    )
    LedgerEntry.objects.create(
        household=household,
        period=period,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 8, 3),
        amount=Decimal("12000.00"),
        description="Personal",
    )
    SavingsMovement.objects.create(
        household=household,
        period=period,
        created_by=owner,
        kind=SavingsMovement.Kind.CONTRIBUTION,
        destination_goal=goal,
        date=date(2026, 8, 4),
        amount=Decimal("150000.00"),
    )

    data = dashboard_data(household, period)

    assert data["period"]["planned_household"] == Decimal("62000.00")
    assert data["period"]["house_balance"] == Decimal("24000.00")
    assert data["period"]["safe_to_spend"] == Decimal("276000.00")
    assert data["period"]["net_cash_flow"] == Decimal("450000.00")
    assert data["bank"]["calculated_balance"] == Decimal("779980.00")
    assert data["savings"]["total"] == Decimal("150000.00")


def test_partial_and_overpayment_status() -> None:
    owner, household = create_household()
    RecurringExpense.objects.create(
        household=household,
        name="Internet",
        expected_amount=Decimal("5200.00"),
        due_day=5,
    )
    period = generate_month(household, 2026, 8)
    planned = period.planned_expenses.get()
    assert planned.payment_status == "unpaid"

    LedgerEntry.objects.create(
        household=household,
        period=period,
        planned_expense=planned,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.HOUSEHOLD_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 8, 5),
        amount=Decimal("2000.00"),
        description="Internet",
    )
    assert planned.payment_status == "partial"

    LedgerEntry.objects.create(
        household=household,
        period=period,
        planned_expense=planned,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.HOUSEHOLD_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 8, 6),
        amount=Decimal("4000.00"),
        description="Internet",
    )
    assert planned.payment_status == "overpaid"


def test_historical_overpayment_becomes_next_month_credit_without_double_charging_bank() -> None:
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
    opening_balance = bank_calculated_balance(household.bank_account)

    LedgerEntry.objects.create(
        household=household,
        period=june,
        planned_expense=june_bill,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.HOUSEHOLD_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 6, 10),
        amount=Decimal("7000.00"),
        description="Electricity",
    )
    refresh_expense_carryovers(household, june)
    refresh_expense_carryovers(household, june)

    july_bill.refresh_from_db()
    assert june_bill.overpaid_amount == Decimal("2000.00")
    assert july_bill.actual_paid_amount == Decimal("0.00")
    assert july_bill.carryover_credit == Decimal("2000.00")
    assert july_bill.paid_amount == Decimal("2000.00")
    assert july_bill.remaining_amount == Decimal("3000.00")
    assert july_bill.payment_status == "partial"
    assert july.ledger_entries.count() == 0
    assert bank_calculated_balance(household.bank_account) == opening_balance - Decimal("7000.00")
    assert dashboard_data(household, july)["period"]["house_balance"] == Decimal("3000.00")


def test_reconciliation_can_post_explicit_adjustment() -> None:
    owner, household = create_household()
    account = household.bank_account
    reconciliation = reconcile_bank(
        account,
        owner,
        date(2026, 8, 10),
        Decimal("330980.00"),
        notes="Bank fee reversal",
        post_adjustment=True,
    )

    assert reconciliation.variance == Decimal("1000.00")
    assert bank_calculated_balance(account) == Decimal("330980.00")
    adjustment = household.ledger_entries.get(entry_type=LedgerEntry.EntryType.ADJUSTMENT)
    assert adjustment.direction == LedgerEntry.Direction.CREDIT


def test_savings_transfer_moves_envelopes_without_changing_bank() -> None:
    owner, household = create_household()
    source = SavingsGoal.objects.create(
        household=household,
        name="Emergency",
        opening_balance=Decimal("50000.00"),
    )
    destination = SavingsGoal.objects.create(household=household, name="Travel")
    period = generate_month(household, 2026, 8)
    before = bank_calculated_balance(household.bank_account)

    SavingsMovement.objects.create(
        household=household,
        period=period,
        created_by=owner,
        kind=SavingsMovement.Kind.TRANSFER,
        source_goal=source,
        destination_goal=destination,
        date=date(2026, 8, 1),
        amount=Decimal("20000.00"),
    )

    assert savings_goal_balance(source) == Decimal("30000.00")
    assert savings_goal_balance(destination) == Decimal("20000.00")
    assert bank_calculated_balance(household.bank_account) == before
