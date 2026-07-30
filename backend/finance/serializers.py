from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from .models import (
    BankAccount,
    BankReconciliation,
    Household,
    HouseholdInvitation,
    LedgerEntry,
    Membership,
    MonthlyIncomePlan,
    MonthlyPeriod,
    Notification,
    PlannedExpense,
    RecurringExpense,
    RecurringIncome,
    SavingsGoal,
    SavingsMovement,
)
from .services import generate_month, savings_goal_balance


class MoneyField(serializers.DecimalField):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(max_digits=14, decimal_places=2, coerce_to_string=False, **kwargs)


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)
    name = serializers.SerializerMethodField()

    def get_name(self, obj: Any) -> str:
        return obj.get_full_name() or obj.email


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user", "role", "is_active", "created_at"]
        read_only_fields = fields


class OwnershipTransferSerializer(serializers.Serializer):
    membership_id = serializers.IntegerField(min_value=1)


class HouseholdSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Household
        fields = [
            "id",
            "name",
            "owner",
            "currency",
            "timezone",
            "monthly_savings_target",
            "savings_reminder_day",
            "onboarding_complete",
        ]
        read_only_fields = ["currency", "timezone", "onboarding_complete"]


class BankAccountSerializer(serializers.ModelSerializer):
    calculated_balance = MoneyField(read_only=True)

    class Meta:
        model = BankAccount
        fields = [
            "id",
            "name",
            "opening_balance",
            "opening_date",
            "calculated_balance",
        ]


class RecurringIncomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringIncome
        fields = ["id", "name", "amount", "active", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class RecurringExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringExpense
        fields = [
            "id",
            "name",
            "expected_amount",
            "due_day",
            "reminder_lead_days",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class MonthlyIncomePlanSerializer(serializers.ModelSerializer):
    received_amount = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyIncomePlan
        fields = ["id", "name", "planned_amount", "received_amount"]

    def get_received_amount(self, obj: MonthlyIncomePlan) -> Decimal:
        return obj.ledger_entries.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")


class PlannedExpenseSerializer(serializers.ModelSerializer):
    actual_paid_amount = MoneyField(read_only=True)
    carryover_credit = MoneyField(read_only=True)
    paid_amount = MoneyField(read_only=True)
    remaining_amount = MoneyField(read_only=True)
    overpaid_amount = MoneyField(read_only=True)
    status = serializers.CharField(source="payment_status", read_only=True)

    class Meta:
        model = PlannedExpense
        fields = [
            "id",
            "name",
            "expected_amount",
            "due_date",
            "reminder_lead_days",
            "actual_paid_amount",
            "carryover_credit",
            "paid_amount",
            "remaining_amount",
            "overpaid_amount",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class MonthlyPeriodSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    income_plans = MonthlyIncomePlanSerializer(many=True, read_only=True)
    planned_expenses = PlannedExpenseSerializer(many=True, read_only=True)

    class Meta:
        model = MonthlyPeriod
        fields = [
            "id",
            "year",
            "month",
            "label",
            "savings_target",
            "income_plans",
            "planned_expenses",
            "created_at",
            "updated_at",
        ]


class LedgerEntrySerializer(serializers.ModelSerializer):
    immutable_fields = {
        "period",
        "planned_income",
        "planned_expense",
        "entry_type",
        "direction",
    }

    class Meta:
        model = LedgerEntry
        fields = [
            "id",
            "period",
            "planned_income",
            "planned_expense",
            "entry_type",
            "direction",
            "date",
            "amount",
            "description",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        request = self.context["request"]
        household = request.user.finance_membership.household
        if self.instance:
            changed_fields = {
                field_name
                for field_name in self.immutable_fields
                if field_name in attrs and attrs[field_name] != getattr(self.instance, field_name)
            }
            if changed_fields:
                raise serializers.ValidationError(
                    {
                        field_name: "This field cannot be changed after a transaction is recorded."
                        for field_name in changed_fields
                    }
                )

        def value(field_name: str):
            return attrs.get(field_name, getattr(self.instance, field_name, None))

        period = value("period")
        if period and period.household_id != household.id:
            raise serializers.ValidationError("Period does not belong to your household.")
        for field_name in ("planned_income", "planned_expense"):
            planned_item = value(field_name)
            if planned_item and planned_item.period.household_id != household.id:
                raise serializers.ValidationError(
                    {field_name: "This item does not belong to your household."}
                )
            if planned_item and period and planned_item.period_id != period.id:
                raise serializers.ValidationError(
                    {field_name: "This item does not belong to the transaction month."}
                )
        entry_date = value("date")
        if (
            period
            and entry_date
            and (entry_date.year, entry_date.month) != (period.year, period.month)
        ):
            raise serializers.ValidationError(
                {"date": "Transaction date must be inside the selected month."}
            )
        entry = LedgerEntry(
            household=household,
            created_by=getattr(self.instance, "created_by", request.user),
            **{
                field_name: value(field_name)
                for field_name in {
                    "period",
                    "planned_income",
                    "planned_expense",
                    "entry_type",
                    "direction",
                    "date",
                    "amount",
                    "description",
                    "notes",
                }
            },
        )
        entry.clean()
        return attrs


class PaymentSerializer(serializers.Serializer):
    amount = MoneyField(min_value=Decimal("0.01"))
    date = serializers.DateField(default=date.today)
    notes = serializers.CharField(required=False, allow_blank=True)


class IncomeReceiptSerializer(serializers.Serializer):
    amount = MoneyField(min_value=Decimal("0.01"))
    date = serializers.DateField(default=date.today)
    notes = serializers.CharField(required=False, allow_blank=True)


class PersonalExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerEntry
        fields = ["id", "period", "date", "amount", "description", "notes", "created_at"]
        read_only_fields = ["created_at"]

    def validate_period(self, period: MonthlyPeriod) -> MonthlyPeriod:
        household_id = self.context["request"].user.finance_membership.household_id
        if period.household_id != household_id:
            raise serializers.ValidationError("Period does not belong to your household.")
        return period

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        period = attrs.get("period") or getattr(self.instance, "period", None)
        entry_date = attrs.get("date") or getattr(self.instance, "date", None)
        if (
            period
            and entry_date
            and (entry_date.year, entry_date.month)
            != (
                period.year,
                period.month,
            )
        ):
            raise serializers.ValidationError(
                {"date": "Expense date must be inside the selected month."}
            )
        return attrs


class SavingsGoalSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = SavingsGoal
        fields = [
            "id",
            "name",
            "opening_balance",
            "target_amount",
            "active",
            "balance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_balance(self, obj: SavingsGoal) -> Decimal:
        return savings_goal_balance(obj)


class SavingsMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsMovement
        fields = [
            "id",
            "period",
            "kind",
            "source_goal",
            "destination_goal",
            "date",
            "amount",
            "notes",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        request = self.context["request"]
        household = request.user.finance_membership.household
        period = attrs.get("period")
        if period and period.household_id != household.id:
            raise serializers.ValidationError("Period does not belong to your household.")
        movement_date = attrs.get("date")
        if (
            period
            and movement_date
            and (movement_date.year, movement_date.month)
            != (
                period.year,
                period.month,
            )
        ):
            raise serializers.ValidationError(
                {"date": "Savings movement date must be inside the selected month."}
            )
        movement = SavingsMovement(
            household=household,
            created_by=request.user,
            **attrs,
        )
        movement.clean()
        if movement.kind in {
            SavingsMovement.Kind.WITHDRAWAL,
            SavingsMovement.Kind.TRANSFER,
        }:
            available = savings_goal_balance(movement.source_goal)
            if (
                self.instance
                and self.instance.source_goal_id == movement.source_goal_id
                and self.instance.kind
                in {
                    SavingsMovement.Kind.WITHDRAWAL,
                    SavingsMovement.Kind.TRANSFER,
                }
            ):
                available += self.instance.amount
            if movement.amount > available:
                raise serializers.ValidationError(
                    {"amount": "This movement exceeds the source goal balance."}
                )
        return attrs


class ReconciliationInputSerializer(serializers.Serializer):
    date = serializers.DateField(default=date.today)
    actual_balance = MoneyField()
    notes = serializers.CharField(required=False, allow_blank=True)
    post_adjustment = serializers.BooleanField(default=False)


class BankReconciliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankReconciliation
        fields = [
            "id",
            "date",
            "actual_balance",
            "calculated_balance",
            "variance",
            "notes",
            "created_at",
        ]


class InvitationSerializer(serializers.ModelSerializer):
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = HouseholdInvitation
        fields = [
            "id",
            "email",
            "status",
            "expires_at",
            "invite_url",
            "created_at",
        ]
        read_only_fields = ["status", "expires_at", "invite_url", "created_at"]

    def get_invite_url(self, obj: HouseholdInvitation) -> str:
        request = self.context.get("request")
        path = f"/invite/{obj.token}"
        return request.build_absolute_uri(path) if request else path

    def create(self, validated_data: dict[str, Any]) -> HouseholdInvitation:
        request = self.context["request"]
        return HouseholdInvitation.objects.create(
            household=request.user.finance_membership.household,
            invited_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
            **validated_data,
        )


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "kind",
            "title",
            "message",
            "action_url",
            "read_at",
            "created_at",
        ]
        read_only_fields = ["kind", "title", "message", "action_url", "created_at"]


class IncomeSetupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    amount = MoneyField(min_value=Decimal("0.01"))


class ExpenseSetupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    expected_amount = MoneyField(min_value=Decimal("0.01"))
    due_day = serializers.IntegerField(min_value=1, max_value=31)
    reminder_lead_days = serializers.IntegerField(min_value=0, max_value=31, default=3)


class SavingsGoalSetupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    opening_balance = MoneyField(min_value=Decimal("0.00"), default=Decimal("0.00"))
    target_amount = MoneyField(min_value=Decimal("0.01"), required=False, allow_null=True)


class OnboardingSerializer(serializers.Serializer):
    household_name = serializers.CharField(max_length=120)
    bank_name = serializers.CharField(max_length=120, default="Main Bank")
    opening_balance = MoneyField()
    opening_date = serializers.DateField()
    monthly_savings_target = MoneyField(min_value=Decimal("0.00"))
    incomes = IncomeSetupSerializer(many=True)
    expenses = ExpenseSetupSerializer(many=True)
    savings_goals = SavingsGoalSetupSerializer(many=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        user = self.context["request"].user
        if hasattr(user, "finance_membership"):
            raise serializers.ValidationError("This account already belongs to a household.")
        if not attrs["incomes"]:
            raise serializers.ValidationError({"incomes": "Add at least one income source."})
        names = [goal["name"].strip().casefold() for goal in attrs["savings_goals"]]
        if len(names) != len(set(names)):
            raise serializers.ValidationError(
                {"savings_goals": "Savings goal names must be unique."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> Household:
        user = self.context["request"].user
        incomes = validated_data.pop("incomes")
        expenses = validated_data.pop("expenses")
        goals = validated_data.pop("savings_goals")
        household = Household.objects.create(
            name=validated_data["household_name"],
            owner=user,
            monthly_savings_target=validated_data["monthly_savings_target"],
            onboarding_complete=True,
        )
        Membership.objects.create(
            user=user,
            household=household,
            role=Membership.Role.OWNER,
        )
        BankAccount.objects.create(
            household=household,
            name=validated_data["bank_name"],
            opening_balance=validated_data["opening_balance"],
            opening_date=validated_data["opening_date"],
        )
        RecurringIncome.objects.bulk_create(
            [RecurringIncome(household=household, **item) for item in incomes]
        )
        RecurringExpense.objects.bulk_create(
            [RecurringExpense(household=household, **item) for item in expenses]
        )
        SavingsGoal.objects.bulk_create(
            [SavingsGoal(household=household, **item) for item in goals]
        )
        generate_month(household, date.today().year, date.today().month)
        return household
