from datetime import date
from decimal import Decimal

import pytest
from django.test import override_settings

from finance.models import LedgerEntry, Notification, RecurringExpense, ReminderDelivery
from finance.services import generate_month, send_due_reminders
from finance.tests.factories import create_household

pytestmark = pytest.mark.django_db


def test_due_reminders_are_idempotent() -> None:
    _, household = create_household()
    household.savings_reminder_day = 28
    household.save(update_fields=["savings_reminder_day"])
    RecurringExpense.objects.create(
        household=household,
        name="Internet",
        expected_amount=Decimal("5200.00"),
        due_day=10,
        reminder_lead_days=3,
    )
    generate_month(household, 2026, 8)

    first = send_due_reminders(today=date(2026, 8, 7))
    second = send_due_reminders(today=date(2026, 8, 7))

    assert first == 1
    assert second == 0
    assert Notification.objects.count() == 1
    assert ReminderDelivery.objects.count() == 1


@override_settings(EMAIL_ENABLED=True)
def test_failed_email_delivery_is_retried(monkeypatch) -> None:
    owner, household = create_household()
    household.savings_reminder_day = 28
    household.save(update_fields=["savings_reminder_day"])
    RecurringExpense.objects.create(
        household=household,
        name="Internet",
        expected_amount=Decimal("5200.00"),
        due_day=10,
        reminder_lead_days=3,
    )
    generate_month(household, 2026, 8)
    attempts = 0

    def flaky_send(*args, **kwargs):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("temporary provider error")
        return 1

    monkeypatch.setattr("finance.services.send_mail", flaky_send)

    send_due_reminders(today=date(2026, 8, 7))
    failed = ReminderDelivery.objects.get(channel="email")
    assert failed.error == "temporary provider error"

    result = send_due_reminders(today=date(2026, 8, 7))
    failed.refresh_from_db()
    assert result == 1
    assert failed.error == ""
    assert attempts == 2
    assert Notification.objects.count() == 1


def test_paid_bill_suppresses_due_and_overdue_reminders() -> None:
    owner, household = create_household()
    household.savings_reminder_day = 28
    household.save(update_fields=["savings_reminder_day"])
    RecurringExpense.objects.create(
        household=household,
        name="Internet",
        expected_amount=Decimal("5200.00"),
        due_day=10,
        reminder_lead_days=3,
    )
    period = generate_month(household, 2026, 8)
    planned = period.planned_expenses.get()
    LedgerEntry.objects.create(
        household=household,
        period=period,
        planned_expense=planned,
        created_by=owner,
        entry_type=LedgerEntry.EntryType.HOUSEHOLD_EXPENSE,
        direction=LedgerEntry.Direction.DEBIT,
        date=date(2026, 8, 9),
        amount=Decimal("5200.00"),
        description="Internet",
    )

    due = send_due_reminders(today=date(2026, 8, 10))
    overdue = send_due_reminders(today=date(2026, 8, 13))

    assert due == 0
    assert overdue == 0
    assert Notification.objects.count() == 0
