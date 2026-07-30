from __future__ import annotations

from calendar import monthrange
from collections.abc import Iterable
from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Case, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import (
    AuditEvent,
    BankAccount,
    BankReconciliation,
    Household,
    LedgerEntry,
    MonthlyIncomePlan,
    MonthlyPeriod,
    Notification,
    PlannedExpense,
    ReminderDelivery,
    SavingsGoal,
    SavingsMovement,
)

ZERO = Decimal("0.00")
MONEY_FIELD = DecimalField(max_digits=14, decimal_places=2)


def user_membership(user: Any):
    membership = getattr(user, "finance_membership", None)
    if not membership or not membership.is_active:
        return None
    return membership


def user_household(user: Any) -> Household | None:
    membership = user_membership(user)
    return membership.household if membership else None


def is_owner(user: Any) -> bool:
    membership = user_membership(user)
    return bool(membership and membership.role == membership.Role.OWNER)


def _adjacent_month(year: int, month: int, offset: int) -> tuple[int, int]:
    month_index = year * 12 + month - 1 + offset
    adjacent_year, zero_based_month = divmod(month_index, 12)
    return adjacent_year, zero_based_month + 1


def _matching_previous_expense(
    expense: PlannedExpense,
    previous_expenses: list[PlannedExpense],
) -> PlannedExpense | None:
    if expense.template_id:
        match = next(
            (
                candidate
                for candidate in previous_expenses
                if candidate.template_id == expense.template_id
            ),
            None,
        )
        if match:
            return match
    normalized_name = expense.name.strip().casefold()
    return next(
        (
            candidate
            for candidate in previous_expenses
            if candidate.name.strip().casefold() == normalized_name
        ),
        None,
    )


@transaction.atomic
def refresh_expense_carryovers(
    household: Household,
    from_period: MonthlyPeriod,
) -> None:
    """Recalculate bill credits from one month through every later existing month."""
    periods = list(
        household.periods.filter(
            Q(year__gt=from_period.year) | Q(year=from_period.year, month__gte=from_period.month)
        ).order_by("year", "month")
    )
    for period in periods:
        previous_year, previous_month = _adjacent_month(period.year, period.month, -1)
        previous = household.periods.filter(
            year=previous_year,
            month=previous_month,
        ).first()
        previous_expenses = (
            list(previous.planned_expenses.prefetch_related("ledger_entries")) if previous else []
        )
        expenses = list(period.planned_expenses.prefetch_related("ledger_entries"))
        changed: list[PlannedExpense] = []
        for expense in expenses:
            prior_expense = _matching_previous_expense(expense, previous_expenses)
            credit = prior_expense.overpaid_amount if prior_expense else ZERO
            if expense.carryover_credit != credit:
                expense.carryover_credit = credit
                changed.append(expense)
        if changed:
            PlannedExpense.objects.bulk_update(changed, ["carryover_credit"])


@transaction.atomic
def generate_month(household: Household, year: int, month: int) -> MonthlyPeriod:
    period, created = MonthlyPeriod.objects.get_or_create(
        household=household,
        year=year,
        month=month,
        defaults={"savings_target": household.monthly_savings_target},
    )
    if created:
        MonthlyIncomePlan.objects.bulk_create(
            [
                MonthlyIncomePlan(
                    period=period,
                    template=template,
                    name=template.name,
                    planned_amount=template.amount,
                )
                for template in household.income_templates.filter(active=True)
            ]
        )
        last_day = monthrange(year, month)[1]
        PlannedExpense.objects.bulk_create(
            [
                PlannedExpense(
                    period=period,
                    template=template,
                    name=template.name,
                    expected_amount=template.expected_amount,
                    due_date=date(year, month, min(template.due_day, last_day)),
                    reminder_lead_days=template.reminder_lead_days,
                )
                for template in household.expense_templates.filter(active=True)
            ]
        )
    refresh_expense_carryovers(household, period)
    return period


@transaction.atomic
def delete_month(period: MonthlyPeriod, actor: Any) -> dict[str, int]:
    """Delete one complete monthly flow while preserving recurring templates."""
    household = period.household
    label = period.label
    next_period = (
        household.periods.filter(
            Q(year__gt=period.year) | Q(year=period.year, month__gt=period.month)
        )
        .order_by("year", "month")
        .first()
    )
    next_year, next_month = _adjacent_month(period.year, period.month, 1)
    month_start = date(period.year, period.month, 1)
    next_month_start = date(next_year, next_month, 1)
    counts = {
        "ledger_entries": period.ledger_entries.count(),
        "savings_movements": period.savings_movements.count(),
        "reconciliations": household.bank_account.reconciliations.filter(
            date__gte=month_start,
            date__lt=next_month_start,
        ).count(),
    }

    period.ledger_entries.all().delete()
    period.savings_movements.all().delete()
    household.bank_account.reconciliations.filter(
        date__gte=month_start,
        date__lt=next_month_start,
    ).delete()
    period.delete()

    if next_period:
        refresh_expense_carryovers(household, next_period)
    AuditEvent.objects.create(
        household=household,
        actor=actor,
        action="month_deleted",
        metadata={"month": label, **counts},
    )
    return counts


def current_period(household: Household, today: date | None = None) -> MonthlyPeriod:
    if today is None:
        today = timezone.now().astimezone(ZoneInfo(household.timezone)).date()
    return generate_month(household, today.year, today.month)


def ledger_signed_total(queryset) -> Decimal:
    result = queryset.aggregate(
        total=Coalesce(
            Sum(
                Case(
                    When(direction=LedgerEntry.Direction.CREDIT, then=F("amount")),
                    default=-F("amount"),
                    output_field=MONEY_FIELD,
                )
            ),
            Value(ZERO, output_field=MONEY_FIELD),
        )
    )
    return result["total"]


def bank_calculated_balance(account: BankAccount, through_date: date | None = None) -> Decimal:
    entries = account.household.ledger_entries.all()
    if through_date:
        entries = entries.filter(date__lte=through_date)
    return account.opening_balance + ledger_signed_total(entries)


def period_amount(
    period: MonthlyPeriod,
    entry_type: str,
    direction: str | None = None,
) -> Decimal:
    queryset = period.ledger_entries.filter(entry_type=entry_type)
    if direction:
        queryset = queryset.filter(direction=direction)
    result = queryset.aggregate(
        total=Coalesce(
            Sum("amount"),
            Value(ZERO, output_field=MONEY_FIELD),
        )
    )
    return result["total"]


def savings_goal_balance(goal: SavingsGoal) -> Decimal:
    incoming = goal.incoming_movements.aggregate(
        total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD))
    )["total"]
    outgoing = goal.outgoing_movements.aggregate(
        total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD))
    )["total"]
    return goal.opening_balance + incoming - outgoing


def period_net_new_savings(period: MonthlyPeriod) -> Decimal:
    contributions = period.savings_movements.filter(
        kind=SavingsMovement.Kind.CONTRIBUTION
    ).aggregate(total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD)))["total"]
    withdrawals = period.savings_movements.filter(kind=SavingsMovement.Kind.WITHDRAWAL).aggregate(
        total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD))
    )["total"]
    return contributions - withdrawals


def period_summary(period: MonthlyPeriod) -> dict[str, Any]:
    income_received = period_amount(
        period, LedgerEntry.EntryType.INCOME, LedgerEntry.Direction.CREDIT
    )
    household_paid = period_amount(
        period, LedgerEntry.EntryType.HOUSEHOLD_EXPENSE, LedgerEntry.Direction.DEBIT
    )
    personal_spent = period_amount(
        period, LedgerEntry.EntryType.PERSONAL_EXPENSE, LedgerEntry.Direction.DEBIT
    )
    planned_expenses = list(period.planned_expenses.prefetch_related("ledger_entries"))
    planned_household = sum(
        (expense.expected_amount for expense in planned_expenses),
        start=ZERO,
    )
    unpaid_household = sum(
        (expense.remaining_amount for expense in planned_expenses),
        start=ZERO,
    )
    planned_income = period.income_plans.aggregate(
        total=Coalesce(Sum("planned_amount"), Value(ZERO, output_field=MONEY_FIELD))
    )["total"]
    net_new_savings = period_net_new_savings(period)
    reserved_savings = max(period.savings_target, net_new_savings)

    return {
        "id": period.id,
        "year": period.year,
        "month": period.month,
        "label": period.label,
        "planned_income": planned_income,
        "income_received": income_received,
        "planned_household": planned_household,
        "household_paid": household_paid,
        "house_balance": unpaid_household,
        "personal_spent": personal_spent,
        "savings_target": period.savings_target,
        "net_new_savings": net_new_savings,
        "safe_to_spend": (income_received - planned_household - reserved_savings - personal_spent),
        "net_cash_flow": income_received - household_paid - personal_spent,
    }


def dashboard_data(household: Household, period: MonthlyPeriod) -> dict[str, Any]:
    summary = period_summary(period)
    account = household.bank_account
    calculated = bank_calculated_balance(account)
    latest_reconciliation = account.reconciliations.first()
    goals = [
        {
            "id": goal.id,
            "name": goal.name,
            "balance": savings_goal_balance(goal),
            "target_amount": goal.target_amount,
        }
        for goal in household.savings_goals.filter(active=True)
    ]
    savings_total = sum((goal["balance"] for goal in goals), start=ZERO)
    planned_expenses = list(period.planned_expenses.prefetch_related("ledger_entries"))
    unpaid = [
        {
            "id": expense.id,
            "name": expense.name,
            "expected_amount": expense.expected_amount,
            "actual_paid_amount": expense.actual_paid_amount,
            "carryover_credit": expense.carryover_credit,
            "paid_amount": expense.paid_amount,
            "remaining_amount": expense.remaining_amount,
            "overpaid_amount": expense.overpaid_amount,
            "due_date": expense.due_date,
            "status": expense.payment_status,
        }
        for expense in planned_expenses
        if expense.payment_status in {"unpaid", "partial"}
    ]
    return {
        "period": summary,
        "bank": {
            "calculated_balance": calculated,
            "actual_balance": (
                latest_reconciliation.actual_balance if latest_reconciliation else None
            ),
            "variance": latest_reconciliation.variance if latest_reconciliation else None,
            "reconciled_at": latest_reconciliation.date if latest_reconciliation else None,
        },
        "savings": {
            "total": savings_total,
            "goals": goals,
            "exceeds_bank": savings_total > calculated,
        },
        "unpaid_bills": unpaid,
    }


def trends_data(household: Household, limit: int = 12) -> list[dict[str, Any]]:
    periods = list(household.periods.order_by("-year", "-month")[:limit])
    periods.reverse()
    rows: list[dict[str, Any]] = []
    running_savings = sum(
        (goal.opening_balance for goal in household.savings_goals.all()), start=ZERO
    )
    for period in periods:
        summary = period_summary(period)
        running_savings += summary["net_new_savings"]
        rows.append({**summary, "savings_total": running_savings})
    return rows


@transaction.atomic
def reconcile_bank(
    account: BankAccount,
    actor: Any,
    reconciliation_date: date,
    actual_balance: Decimal,
    notes: str = "",
    post_adjustment: bool = False,
) -> BankReconciliation:
    calculated = bank_calculated_balance(account, through_date=reconciliation_date)
    variance = actual_balance - calculated
    reconciliation = BankReconciliation.objects.create(
        account=account,
        created_by=actor,
        date=reconciliation_date,
        actual_balance=actual_balance,
        calculated_balance=calculated,
        variance=variance,
        notes=notes,
    )
    if post_adjustment and variance:
        period = generate_month(
            account.household, reconciliation_date.year, reconciliation_date.month
        )
        LedgerEntry.objects.create(
            household=account.household,
            period=period,
            created_by=actor,
            entry_type=LedgerEntry.EntryType.ADJUSTMENT,
            direction=(
                LedgerEntry.Direction.CREDIT if variance > 0 else LedgerEntry.Direction.DEBIT
            ),
            date=reconciliation_date,
            amount=abs(variance),
            description="Bank reconciliation adjustment",
            notes=notes,
        )
    return reconciliation


def _send_notification(
    *,
    household: Household,
    recipient: Any,
    key: str,
    kind: str,
    title: str,
    message: str,
    action_url: str,
) -> int:
    created = 0
    in_app_key = f"{key}:in_app"
    if not ReminderDelivery.objects.filter(key=in_app_key).exists():
        Notification.objects.create(
            household=household,
            recipient=recipient,
            kind=kind,
            title=title,
            message=message,
            action_url=action_url,
        )
        ReminderDelivery.objects.create(
            household=household,
            recipient=recipient,
            key=in_app_key,
            channel="in_app",
        )
        created += 1

    email_key = f"{key}:email"
    delivery = ReminderDelivery.objects.filter(key=email_key).first()
    if settings.EMAIL_ENABLED and (delivery is None or delivery.error):
        error = ""
        try:
            send_mail(
                subject=title,
                message=f"{message}\n\n{settings.APP_BASE_URL}{action_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient.email],
            )
        except Exception as exc:  # pragma: no cover - provider/network behavior
            error = str(exc)
        if delivery:
            delivery.error = error
            delivery.sent_at = timezone.now()
            delivery.save(update_fields=["error", "sent_at", "updated_at"])
        else:
            ReminderDelivery.objects.create(
                household=household,
                recipient=recipient,
                key=email_key,
                channel="email",
                error=error,
            )
        created += int(not error)
    return created


def send_due_reminders(today: date | None = None) -> int:
    total = 0
    for household in Household.objects.filter(onboarding_complete=True).select_related("owner"):
        local_today = today or timezone.now().astimezone(ZoneInfo(household.timezone)).date()
        period = generate_month(household, local_today.year, local_today.month)
        expenses: Iterable[PlannedExpense] = period.planned_expenses.prefetch_related(
            "ledger_entries"
        )
        for expense in expenses:
            if expense.payment_status in {"paid", "overpaid"}:
                continue
            lead_date = expense.due_date - timedelta(days=expense.reminder_lead_days)
            days_overdue = (local_today - expense.due_date).days
            if local_today == lead_date:
                stage = "upcoming"
                kind = Notification.Kind.BILL_DUE
            elif local_today == expense.due_date:
                stage = "due"
                kind = Notification.Kind.BILL_DUE
            elif days_overdue > 0 and days_overdue % 3 == 0:
                stage = f"overdue-{days_overdue}"
                kind = Notification.Kind.BILL_OVERDUE
            else:
                continue
            total += _send_notification(
                household=household,
                recipient=household.owner,
                key=f"bill:{expense.id}:{stage}:{local_today.isoformat()}",
                kind=kind,
                title=f"{expense.name} is {stage.replace('-', ' ')}",
                message=(
                    f"Rs {expense.remaining_amount:,.2f} remains against "
                    f"Rs {expense.expected_amount:,.2f}."
                ),
                action_url=f"/app/month/{period.label}",
            )

        if local_today.day == household.savings_reminder_day:
            saved = period_net_new_savings(period)
            if saved < period.savings_target:
                remaining = period.savings_target - saved
                total += _send_notification(
                    household=household,
                    recipient=household.owner,
                    key=f"savings:{period.id}:{local_today.isoformat()}",
                    kind=Notification.Kind.SAVINGS,
                    title="Monthly savings target needs attention",
                    message=f"Rs {remaining:,.2f} remains to reach this month's target.",
                    action_url="/app/savings",
                )
    return total


def audit_export(household: Household, actor: Any, export_type: str) -> None:
    AuditEvent.objects.create(
        household=household,
        actor=actor,
        action="data_export",
        metadata={"type": export_type, "includes_private_entries": True},
    )
