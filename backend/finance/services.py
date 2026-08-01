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
    RecurringExpense,
    RecurringIncome,
    ReminderDelivery,
    RolloverAllocation,
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
            Q(year__gt=from_period.year) | Q(year=from_period.year, month__gte=from_period.month),
            is_deleted=False,
        ).order_by("year", "month")
    )
    for period in periods:
        previous_year, previous_month = _adjacent_month(period.year, period.month, -1)
        previous = household.periods.filter(
            year=previous_year,
            month=previous_month,
            is_deleted=False,
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
    refresh_month_rollovers(household, from_period)


@transaction.atomic
def sync_recurring_income_to_latest_month(template: RecurringIncome) -> None:
    """Keep the newest monthly snapshot aligned after its source template is edited."""
    latest_period = (
        template.household.periods.filter(is_deleted=False).order_by("-year", "-month").first()
    )
    if latest_period is None:
        return
    template.monthly_snapshots.filter(period=latest_period).update(
        name=template.name,
        planned_amount=template.amount,
        updated_at=timezone.now(),
    )


@transaction.atomic
def sync_recurring_expense_to_latest_month(template: RecurringExpense) -> None:
    """Keep the newest bill snapshot aligned without rewriting earlier months."""
    latest_period = (
        template.household.periods.filter(is_deleted=False).order_by("-year", "-month").first()
    )
    if latest_period is None:
        return
    last_day = monthrange(latest_period.year, latest_period.month)[1]
    changed = template.monthly_snapshots.filter(period=latest_period).update(
        name=template.name,
        expected_amount=template.expected_amount,
        due_date=date(
            latest_period.year,
            latest_period.month,
            min(template.due_day, last_day),
        ),
        reminder_lead_days=template.reminder_lead_days,
        updated_at=timezone.now(),
    )
    if changed:
        refresh_expense_carryovers(template.household, latest_period)


@transaction.atomic
def generate_month(
    household: Household,
    year: int,
    month: int,
    *,
    restore_deleted: bool = False,
) -> MonthlyPeriod:
    period, created = MonthlyPeriod.objects.get_or_create(
        household=household,
        year=year,
        month=month,
        defaults={"savings_target": household.monthly_savings_target},
    )
    if period.is_deleted and not restore_deleted:
        return period
    if period.is_deleted:
        period.is_deleted = False
        period.savings_target = household.monthly_savings_target
        period.save(update_fields=["is_deleted", "savings_target", "updated_at"])
        created = True
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
            Q(year__gt=period.year) | Q(year=period.year, month__gt=period.month),
            is_deleted=False,
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
        "rollover_allocations": household.rollover_allocations.filter(
            Q(source_period=period) | Q(destination_period=period)
        ).count(),
        "reconciliations": household.bank_account.reconciliations.filter(
            date__gte=month_start,
            date__lt=next_month_start,
        ).count(),
    }

    period.ledger_entries.all().delete()
    period.incoming_rollover_allocations.all().delete()
    period.outgoing_rollover_allocations.all().delete()
    period.savings_movements.all().delete()
    household.bank_account.reconciliations.filter(
        date__gte=month_start,
        date__lt=next_month_start,
    ).delete()
    period.income_plans.all().delete()
    period.planned_expenses.all().delete()
    period.is_deleted = True
    period.save(update_fields=["is_deleted", "updated_at"])

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


def savings_cash_total(queryset) -> Decimal:
    result = queryset.aggregate(
        total=Coalesce(
            Sum(
                Case(
                    When(kind=SavingsMovement.Kind.CONTRIBUTION, then=F("amount")),
                    When(kind=SavingsMovement.Kind.WITHDRAWAL, then=-F("amount")),
                    default=Value(ZERO),
                    output_field=MONEY_FIELD,
                )
            ),
            Value(ZERO, output_field=MONEY_FIELD),
        )
    )
    return result["total"]


def bank_calculated_balance(account: BankAccount, through_date: date | None = None) -> Decimal:
    entries = account.household.ledger_entries.all()
    savings_movements = account.household.savings_movements.all()
    if through_date:
        entries = entries.filter(date__lte=through_date)
        savings_movements = savings_movements.filter(date__lte=through_date)
    return (
        account.opening_balance
        + ledger_signed_total(entries)
        + savings_cash_total(savings_movements)
    )


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
    incoming = period.savings_movements.filter(
        kind__in=[SavingsMovement.Kind.CONTRIBUTION, SavingsMovement.Kind.ALLOCATION]
    ).aggregate(total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD)))["total"]
    withdrawals = period.savings_movements.filter(kind=SavingsMovement.Kind.WITHDRAWAL).aggregate(
        total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD))
    )["total"]
    return incoming - withdrawals


def period_reserved_savings(
    period: MonthlyPeriod,
    *,
    include_safe_to_spend_allocations: bool = True,
) -> Decimal:
    """Savings that should reduce safe-to-spend without double-counting unpaid bills."""
    external_contributions = period.savings_movements.filter(
        kind=SavingsMovement.Kind.CONTRIBUTION
    ).aggregate(total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD)))["total"]
    withdrawals = period.savings_movements.filter(kind=SavingsMovement.Kind.WITHDRAWAL).aggregate(
        total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD))
    )["total"]
    reserved = max(period.savings_target, external_contributions - withdrawals)
    if include_safe_to_spend_allocations:
        safe_allocations = period.savings_movements.filter(
            kind=SavingsMovement.Kind.ALLOCATION,
            rollover_allocation__source_kind=RolloverAllocation.SourceKind.SAFE_TO_SPEND,
        ).aggregate(total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD)))["total"]
        reserved += safe_allocations
    return reserved


def period_safe_to_spend_carryover(period: MonthlyPeriod) -> Decimal:
    return period.incoming_rollover_allocations.filter(
        source_kind=RolloverAllocation.SourceKind.SAFE_TO_SPEND,
        action=RolloverAllocation.Action.CARRYOVER,
    ).aggregate(total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD)))["total"]


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
    reserved_savings = period_reserved_savings(period)
    safe_to_spend_carryover = period_safe_to_spend_carryover(period)

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
        "safe_to_spend_carryover": safe_to_spend_carryover,
        "safe_to_spend": (
            safe_to_spend_carryover
            + income_received
            - planned_household
            - reserved_savings
            - personal_spent
        ),
        "net_cash_flow": income_received - household_paid - personal_spent,
    }


def rollover_available_safe_to_spend(period: MonthlyPeriod) -> Decimal:
    income_received = period_amount(
        period, LedgerEntry.EntryType.INCOME, LedgerEntry.Direction.CREDIT
    )
    planned_household = period.planned_expenses.aggregate(
        total=Coalesce(Sum("expected_amount"), Value(ZERO, output_field=MONEY_FIELD))
    )["total"]
    personal_spent = period_amount(
        period, LedgerEntry.EntryType.PERSONAL_EXPENSE, LedgerEntry.Direction.DEBIT
    )
    return (
        period_safe_to_spend_carryover(period)
        + income_received
        - planned_household
        - period_reserved_savings(period, include_safe_to_spend_allocations=False)
        - personal_spent
    )


def rollover_preview(household: Household, year: int, month: int) -> dict[str, Any]:
    destination = household.periods.filter(
        year=year,
        month=month,
        is_deleted=False,
    ).first()
    fixed_savings_target = (
        destination.savings_target if destination else household.monthly_savings_target
    )
    if (
        destination
        and destination.outgoing_rollover_allocations.filter(
            source_kind=RolloverAllocation.SourceKind.FIXED_SAVINGS
        ).exists()
    ):
        fixed_savings_target = ZERO
    previous_year, previous_month = _adjacent_month(year, month, -1)
    source = household.periods.filter(
        year=previous_year,
        month=previous_month,
        is_deleted=False,
    ).first()
    if source is None:
        return {
            "source_month": None,
            "unpaid_expenses": [],
            "safe_to_spend": ZERO,
            "fixed_savings_target": fixed_savings_target,
        }

    completed_keys = set(source.outgoing_rollover_allocations.values_list("source_key", flat=True))
    unpaid_expenses = [
        {
            "id": expense.id,
            "name": expense.name,
            "remaining_amount": expense.remaining_amount,
        }
        for expense in source.planned_expenses.prefetch_related("ledger_entries")
        if expense.remaining_amount > ZERO and f"bill:{expense.id}" not in completed_keys
    ]
    safe_to_spend = (
        ZERO
        if "safe_to_spend" in completed_keys
        else max(rollover_available_safe_to_spend(source), ZERO)
    )
    return {
        "source_month": source.label,
        "unpaid_expenses": unpaid_expenses,
        "safe_to_spend": safe_to_spend,
        "fixed_savings_target": fixed_savings_target,
    }


class RolloverValidationError(ValueError):
    pass


@transaction.atomic
def apply_month_rollovers(
    household: Household,
    destination: MonthlyPeriod,
    actor: Any,
    *,
    bill_allocations: list[dict[str, int]],
    safe_to_spend: dict[str, Any] | None,
    fixed_savings_goal: int | None,
) -> None:
    active_goals = {goal.id: goal for goal in household.savings_goals.filter(active=True)}

    def goal_for(goal_id: int) -> SavingsGoal:
        goal = active_goals.get(goal_id)
        if goal is None:
            raise RolloverValidationError("Choose an active savings goal in this household.")
        return goal

    if (
        fixed_savings_goal
        and destination.savings_target > ZERO
        and not destination.outgoing_rollover_allocations.filter(
            source_kind=RolloverAllocation.SourceKind.FIXED_SAVINGS
        ).exists()
    ):
        fixed_goal = goal_for(fixed_savings_goal)
        fixed_allocation = RolloverAllocation(
            household=household,
            source_period=destination,
            destination_period=destination,
            destination_goal=fixed_goal,
            created_by=actor,
            source_kind=RolloverAllocation.SourceKind.FIXED_SAVINGS,
            source_key="fixed_savings",
            action=RolloverAllocation.Action.SAVINGS,
            amount=destination.savings_target,
        )
        fixed_allocation.full_clean()
        fixed_allocation.save()
        SavingsMovement.objects.create(
            household=household,
            period=destination,
            created_by=actor,
            rollover_allocation=fixed_allocation,
            kind=SavingsMovement.Kind.ALLOCATION,
            destination_goal=fixed_goal,
            date=date(destination.year, destination.month, 1),
            amount=fixed_allocation.amount,
            notes=f"Fixed monthly savings allocated for {destination.label}",
        )

    previous_year, previous_month = _adjacent_month(destination.year, destination.month, -1)
    source = household.periods.filter(
        year=previous_year,
        month=previous_month,
        is_deleted=False,
    ).first()
    if source is None:
        if bill_allocations or safe_to_spend:
            raise RolloverValidationError("The previous calendar month is not available.")
        return

    seen_expenses: set[int] = set()
    for item in bill_allocations:
        expense_id = item["planned_expense"]
        if expense_id in seen_expenses:
            raise RolloverValidationError("Each household bill can be allocated only once.")
        seen_expenses.add(expense_id)
        source_key = f"bill:{expense_id}"
        if source.outgoing_rollover_allocations.filter(source_key=source_key).exists():
            continue
        expense = (
            source.planned_expenses.prefetch_related("ledger_entries").filter(pk=expense_id).first()
        )
        if expense is None or expense.remaining_amount <= ZERO:
            raise RolloverValidationError("Choose an unpaid bill from the previous month.")
        goal = goal_for(item["destination_goal"])
        allocation = RolloverAllocation(
            household=household,
            source_period=source,
            destination_period=destination,
            source_expense=expense,
            destination_goal=goal,
            created_by=actor,
            source_kind=RolloverAllocation.SourceKind.HOUSEHOLD_REMAINDER,
            source_key=source_key,
            action=RolloverAllocation.Action.SAVINGS,
            amount=expense.remaining_amount,
        )
        allocation.full_clean()
        allocation.save()
        SavingsMovement.objects.create(
            household=household,
            period=source,
            created_by=actor,
            rollover_allocation=allocation,
            kind=SavingsMovement.Kind.ALLOCATION,
            destination_goal=goal,
            date=date(source.year, source.month, source.last_day),
            amount=allocation.amount,
            notes=f"Unpaid {expense.name} moved to savings when {destination.label} was created",
        )

    if not safe_to_spend:
        return
    if source.outgoing_rollover_allocations.filter(source_key="safe_to_spend").exists():
        return
    available = max(rollover_available_safe_to_spend(source), ZERO)
    if available <= ZERO:
        raise RolloverValidationError("There is no positive safe-to-spend amount to move.")
    action = safe_to_spend["action"]
    goal = (
        goal_for(safe_to_spend["destination_goal"])
        if action == RolloverAllocation.Action.SAVINGS
        else None
    )
    allocation = RolloverAllocation(
        household=household,
        source_period=source,
        destination_period=destination,
        destination_goal=goal,
        created_by=actor,
        source_kind=RolloverAllocation.SourceKind.SAFE_TO_SPEND,
        source_key="safe_to_spend",
        action=action,
        amount=available,
    )
    allocation.full_clean()
    allocation.save()
    if action == RolloverAllocation.Action.SAVINGS:
        SavingsMovement.objects.create(
            household=household,
            period=source,
            created_by=actor,
            rollover_allocation=allocation,
            kind=SavingsMovement.Kind.ALLOCATION,
            destination_goal=goal,
            date=date(source.year, source.month, source.last_day),
            amount=allocation.amount,
            notes=f"Safe-to-spend moved to savings when {destination.label} was created",
        )


@transaction.atomic
def refresh_month_rollovers(household: Household, from_period: MonthlyPeriod) -> None:
    """Keep finalized rollover amounts accurate after historical transactions change."""
    periods = household.periods.filter(
        Q(year__gt=from_period.year) | Q(year=from_period.year, month__gte=from_period.month),
        is_deleted=False,
    ).order_by("year", "month")
    for period in periods:
        allocations = list(
            period.outgoing_rollover_allocations.select_related(
                "source_expense",
                "destination_goal",
            ).prefetch_related("source_expense__ledger_entries")
        )
        for allocation in allocations:
            if allocation.source_kind == RolloverAllocation.SourceKind.HOUSEHOLD_REMAINDER:
                amount = allocation.source_expense.remaining_amount
            elif allocation.source_kind == RolloverAllocation.SourceKind.FIXED_SAVINGS:
                amount = period.savings_target
            else:
                amount = max(rollover_available_safe_to_spend(period), ZERO)
            if amount <= ZERO:
                allocation.delete()
                continue
            if allocation.amount == amount:
                continue
            allocation.amount = amount
            allocation.save(update_fields=["amount", "updated_at"])
            SavingsMovement.objects.filter(rollover_allocation=allocation).update(
                amount=amount,
                updated_at=timezone.now(),
            )


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
    periods = list(household.periods.filter(is_deleted=False).order_by("-year", "-month")[:limit])
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
