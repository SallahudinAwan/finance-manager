from __future__ import annotations

import uuid
from calendar import monthrange
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

ZERO = Decimal("0.00")


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Household(TimestampedModel):
    name = models.CharField(max_length=120)
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_household",
    )
    currency = models.CharField(max_length=3, default="PKR", editable=False)
    timezone = models.CharField(max_length=64, default="Asia/Karachi", editable=False)
    monthly_savings_target = models.DecimalField(max_digits=14, decimal_places=2, default=ZERO)
    savings_reminder_day = models.PositiveSmallIntegerField(default=25)
    onboarding_complete = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(monthly_savings_target__gte=0),
                name="household_nonnegative_savings_target",
            ),
            models.CheckConstraint(
                condition=Q(savings_reminder_day__gte=1, savings_reminder_day__lte=28),
                name="household_valid_savings_reminder_day",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Membership(TimestampedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        MEMBER = "member", "Member"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="finance_membership",
    )
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=16, choices=Role.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["household", "is_active"])]

    def __str__(self) -> str:
        return f"{self.user} · {self.household} · {self.role}"


class UserPreference(TimestampedModel):
    class Language(models.TextChoices):
        ENGLISH = "en", "English"
        URDU = "ur", "Urdu"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="finance_preference",
    )
    preferred_language = models.CharField(
        max_length=2,
        choices=Language.choices,
        default=Language.ENGLISH,
    )

    def __str__(self) -> str:
        return f"{self.user} · {self.get_preferred_language_display()}"


class HouseholdInvitation(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"
        EXPIRED = "expired", "Expired"

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField()
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sent_household_invitations",
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="accepted_household_invitations",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["household", "email"],
                condition=Q(status="pending"),
                name="one_pending_invite_per_household_email",
            )
        ]

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()


class BankAccount(TimestampedModel):
    household = models.OneToOneField(
        Household, on_delete=models.CASCADE, related_name="bank_account"
    )
    name = models.CharField(max_length=120, default="Main Bank")
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2)
    opening_date = models.DateField()

    def __str__(self) -> str:
        return f"{self.household.name} · {self.name}"


class RecurringIncome(TimestampedModel):
    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="income_templates"
    )
    name = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0), name="recurring_income_positive_amount"
            )
        ]


class RecurringExpense(TimestampedModel):
    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="expense_templates"
    )
    name = models.CharField(max_length=120)
    expected_amount = models.DecimalField(max_digits=14, decimal_places=2)
    due_day = models.PositiveSmallIntegerField(default=1)
    reminder_lead_days = models.PositiveSmallIntegerField(default=3)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["due_day", "name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(expected_amount__gt=0),
                name="recurring_expense_positive_amount",
            ),
            models.CheckConstraint(
                condition=Q(due_day__gte=1, due_day__lte=31),
                name="recurring_expense_valid_due_day",
            ),
            models.CheckConstraint(
                condition=Q(reminder_lead_days__lte=31),
                name="recurring_expense_valid_lead_days",
            ),
        ]


class MonthlyPeriod(TimestampedModel):
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="periods")
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    savings_target = models.DecimalField(max_digits=14, decimal_places=2, default=ZERO)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ["-year", "-month"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "year", "month"], name="unique_household_month"
            ),
            models.CheckConstraint(
                condition=Q(month__gte=1, month__lte=12), name="period_valid_month"
            ),
            models.CheckConstraint(
                condition=Q(savings_target__gte=0),
                name="period_nonnegative_savings_target",
            ),
        ]

    @property
    def label(self) -> str:
        return f"{self.year:04d}-{self.month:02d}"

    @property
    def last_day(self) -> int:
        return monthrange(self.year, self.month)[1]

    def __str__(self) -> str:
        return f"{self.household.name} · {self.label}"


class MonthlyIncomePlan(TimestampedModel):
    period = models.ForeignKey(MonthlyPeriod, on_delete=models.CASCADE, related_name="income_plans")
    template = models.ForeignKey(
        RecurringIncome,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="monthly_snapshots",
    )
    name = models.CharField(max_length=120)
    planned_amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(planned_amount__gt=0),
                name="monthly_income_plan_positive",
            )
        ]


class PlannedExpense(TimestampedModel):
    period = models.ForeignKey(
        MonthlyPeriod, on_delete=models.CASCADE, related_name="planned_expenses"
    )
    template = models.ForeignKey(
        RecurringExpense,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="monthly_snapshots",
    )
    name = models.CharField(max_length=120)
    expected_amount = models.DecimalField(max_digits=14, decimal_places=2)
    carryover_credit = models.DecimalField(max_digits=14, decimal_places=2, default=ZERO)
    due_date = models.DateField()
    reminder_lead_days = models.PositiveSmallIntegerField(default=3)

    class Meta:
        ordering = ["due_date", "name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(expected_amount__gt=0),
                name="planned_expense_positive_amount",
            ),
            models.CheckConstraint(
                condition=Q(carryover_credit__gte=0),
                name="planned_expense_nonnegative_carryover",
            ),
        ]

    @property
    def actual_paid_amount(self) -> Decimal:
        return sum(
            (entry.amount for entry in self.ledger_entries.all()),
            start=ZERO,
        )

    @property
    def paid_amount(self) -> Decimal:
        return self.actual_paid_amount + self.carryover_credit

    @property
    def remaining_amount(self) -> Decimal:
        return max(self.expected_amount - self.paid_amount, ZERO)

    @property
    def overpaid_amount(self) -> Decimal:
        return max(self.paid_amount - self.expected_amount, ZERO)

    @property
    def payment_status(self) -> str:
        paid = self.paid_amount
        if paid == 0:
            return "unpaid"
        if paid < self.expected_amount:
            return "partial"
        if paid == self.expected_amount:
            return "paid"
        return "overpaid"


class LedgerEntry(TimestampedModel):
    class EntryType(models.TextChoices):
        INCOME = "income", "Income"
        HOUSEHOLD_EXPENSE = "household_expense", "Household expense"
        PERSONAL_EXPENSE = "personal_expense", "Personal expense"
        ADJUSTMENT = "adjustment", "Bank adjustment"

    class Direction(models.TextChoices):
        CREDIT = "credit", "Credit"
        DEBIT = "debit", "Debit"

    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="ledger_entries"
    )
    period = models.ForeignKey(
        MonthlyPeriod, on_delete=models.PROTECT, related_name="ledger_entries"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="finance_ledger_entries",
    )
    planned_income = models.ForeignKey(
        MonthlyIncomePlan,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger_entries",
    )
    planned_expense = models.ForeignKey(
        PlannedExpense,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger_entries",
    )
    entry_type = models.CharField(max_length=32, choices=EntryType.choices)
    direction = models.CharField(max_length=8, choices=Direction.choices)
    date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    description = models.CharField(max_length=160)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["household", "date"]),
            models.Index(fields=["period", "entry_type"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="ledger_entry_positive_amount")
        ]

    @property
    def signed_amount(self) -> Decimal:
        return self.amount if self.direction == self.Direction.CREDIT else -self.amount

    @property
    def is_private(self) -> bool:
        return self.entry_type == self.EntryType.PERSONAL_EXPENSE

    def clean(self) -> None:
        super().clean()
        if self.period_id and self.household_id != self.period.household_id:
            raise ValidationError("The period must belong to the same household.")
        if self.entry_type == self.EntryType.INCOME and self.direction != self.Direction.CREDIT:
            raise ValidationError("Income must be a credit.")
        if (
            self.entry_type
            in {
                self.EntryType.HOUSEHOLD_EXPENSE,
                self.EntryType.PERSONAL_EXPENSE,
            }
            and self.direction != self.Direction.DEBIT
        ):
            raise ValidationError("Expenses must be debits.")
        if self.planned_expense_id and self.entry_type != self.EntryType.HOUSEHOLD_EXPENSE:
            raise ValidationError("Only household expenses can reference a planned expense.")
        if self.planned_income_id and self.entry_type != self.EntryType.INCOME:
            raise ValidationError("Only income can reference a planned income.")


class SavingsGoal(TimestampedModel):
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="savings_goals")
    name = models.CharField(max_length=120)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=ZERO)
    target_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["household", "name"], name="unique_savings_goal_name"),
            models.CheckConstraint(
                condition=Q(opening_balance__gte=0),
                name="savings_goal_nonnegative_opening",
            ),
            models.CheckConstraint(
                condition=Q(target_amount__isnull=True) | Q(target_amount__gt=0),
                name="savings_goal_positive_target",
            ),
        ]


class SavingsMovement(TimestampedModel):
    class Kind(models.TextChoices):
        CONTRIBUTION = "contribution", "Contribution"
        WITHDRAWAL = "withdrawal", "Withdrawal"
        TRANSFER = "transfer", "Transfer"

    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="savings_movements"
    )
    period = models.ForeignKey(
        MonthlyPeriod,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="savings_movements",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="savings_movements",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    source_goal = models.ForeignKey(
        SavingsGoal,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="outgoing_movements",
    )
    destination_goal = models.ForeignKey(
        SavingsGoal,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="incoming_movements",
    )
    date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0), name="savings_movement_positive_amount"
            )
        ]

    def clean(self) -> None:
        super().clean()
        if self.kind == self.Kind.CONTRIBUTION:
            if not self.destination_goal_id or self.source_goal_id:
                raise ValidationError("A contribution requires only a destination goal.")
        elif self.kind == self.Kind.WITHDRAWAL:
            if not self.source_goal_id or self.destination_goal_id:
                raise ValidationError("A withdrawal requires only a source goal.")
        elif self.kind == self.Kind.TRANSFER:
            if not self.source_goal_id or not self.destination_goal_id:
                raise ValidationError("A transfer requires source and destination goals.")
            if self.source_goal_id == self.destination_goal_id:
                raise ValidationError("Transfer goals must be different.")
        for goal in (self.source_goal, self.destination_goal):
            if goal and goal.household_id != self.household_id:
                raise ValidationError("Savings goals must belong to the same household.")


class BankReconciliation(TimestampedModel):
    account = models.ForeignKey(
        BankAccount, on_delete=models.CASCADE, related_name="reconciliations"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="bank_reconciliations",
    )
    date = models.DateField()
    actual_balance = models.DecimalField(max_digits=14, decimal_places=2)
    calculated_balance = models.DecimalField(max_digits=14, decimal_places=2)
    variance = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]


class Notification(TimestampedModel):
    class Kind(models.TextChoices):
        BILL_DUE = "bill_due", "Bill due"
        BILL_OVERDUE = "bill_overdue", "Bill overdue"
        SAVINGS = "savings", "Savings"
        INVITATION = "invitation", "Invitation"
        SYSTEM = "system", "System"

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="notifications")
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="finance_notifications",
    )
    kind = models.CharField(max_length=24, choices=Kind.choices)
    title = models.CharField(max_length=160)
    message = models.TextField()
    action_url = models.CharField(max_length=255, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "read_at"])]


class ReminderDelivery(TimestampedModel):
    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="reminder_deliveries"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="finance_reminder_deliveries",
    )
    key = models.CharField(max_length=180, unique=True)
    channel = models.CharField(max_length=16)
    sent_at = models.DateTimeField(default=timezone.now)
    error = models.TextField(blank=True)


class AuditEvent(TimestampedModel):
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="audit_events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="finance_audit_events",
    )
    action = models.CharField(max_length=80)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
