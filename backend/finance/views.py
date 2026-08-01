from __future__ import annotations

import csv
from datetime import date
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection, transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
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
    UserPreference,
)
from .permissions import HasHousehold, IsHouseholdOwner, OwnerWriteMemberRead
from .serializers import (
    BankAccountSerializer,
    BankReconciliationSerializer,
    HouseholdSerializer,
    IncomeReceiptSerializer,
    InvitationSerializer,
    LedgerEntrySerializer,
    MembershipSerializer,
    MonthGenerateInputSerializer,
    MonthlyPeriodSerializer,
    MonthRolloverInputSerializer,
    NotificationSerializer,
    OnboardingSerializer,
    OwnershipTransferSerializer,
    PaymentSerializer,
    PersonalExpenseSerializer,
    PlannedExpenseSerializer,
    ReconciliationInputSerializer,
    RecurringExpenseSerializer,
    RecurringIncomeSerializer,
    RolloverAllocationSerializer,
    RolloverPreviewSerializer,
    SavingsGoalSerializer,
    SavingsMovementSerializer,
    UserPreferenceSerializer,
    UserSerializer,
)
from .services import (
    RolloverValidationError,
    apply_month_rollovers,
    audit_export,
    bank_calculated_balance,
    current_period,
    dashboard_data,
    delete_month,
    generate_month,
    is_owner,
    period_summary,
    reconcile_bank,
    refresh_expense_carryovers,
    refresh_month_rollovers,
    rollover_preview,
    sync_recurring_expense_to_latest_month,
    sync_recurring_income_to_latest_month,
    trends_data,
    user_household,
    user_membership,
)


class HealthDetailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request) -> Response:
        connection.ensure_connection()
        return Response({"status": "ok", "database": "connected"})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class SessionView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request) -> Response:
        membership = user_membership(request.user)
        preference = UserPreference.objects.filter(user=request.user).first()
        user_data = UserSerializer(request.user).data
        user_data["preferred_language"] = preference.preferred_language if preference else None
        user_data["tour_completed"] = preference.tour_completed if preference else False
        return Response(
            {
                "user": user_data,
                "membership": (
                    {
                        "role": membership.role,
                        "household_id": membership.household_id,
                    }
                    if membership
                    else None
                ),
                "household": (
                    HouseholdSerializer(membership.household).data if membership else None
                ),
                "is_owner": is_owner(request.user),
                "needs_onboarding": membership is None,
                "needs_language_selection": preference is None,
            }
        )


class UserPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserPreferenceSerializer})
    def get(self, request) -> Response:
        preference = UserPreference.objects.filter(user=request.user).first() or UserPreference(
            user=request.user
        )
        return Response(UserPreferenceSerializer(preference).data)

    @extend_schema(
        request=UserPreferenceSerializer,
        responses={200: UserPreferenceSerializer},
    )
    def patch(self, request) -> Response:
        preference = UserPreference.objects.filter(user=request.user).first() or UserPreference(
            user=request.user
        )
        serializer = UserPreferenceSerializer(preference, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OnboardingView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=OnboardingSerializer, responses={201: HouseholdSerializer})
    def post(self, request) -> Response:
        serializer = OnboardingSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        household = serializer.save()
        return Response(HouseholdSerializer(household).data, status=status.HTTP_201_CREATED)


class HouseholdView(APIView):
    permission_classes = [HasHousehold]

    @extend_schema(responses={200: HouseholdSerializer})
    def get(self, request) -> Response:
        return Response(HouseholdSerializer(user_household(request.user)).data)

    @extend_schema(request=HouseholdSerializer, responses={200: HouseholdSerializer})
    def patch(self, request) -> Response:
        if not is_owner(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = HouseholdSerializer(
            user_household(request.user),
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        return Response(HouseholdSerializer(serializer.save()).data)


class HouseholdMembersView(APIView):
    permission_classes = [HasHousehold]

    @extend_schema(responses={200: MembershipSerializer(many=True)})
    def get(self, request) -> Response:
        memberships = (
            user_household(request.user)
            .memberships.filter(is_active=True)
            .select_related("user")
            .order_by("created_at")
        )
        return Response(MembershipSerializer(memberships, many=True).data)


class TransferOwnershipView(APIView):
    permission_classes = [IsHouseholdOwner]

    @transaction.atomic
    @extend_schema(request=OwnershipTransferSerializer, responses={200: OpenApiTypes.OBJECT})
    def post(self, request) -> Response:
        serializer = OwnershipTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        household = user_household(request.user)
        target = get_object_or_404(
            household.memberships.select_for_update(),
            pk=serializer.validated_data["membership_id"],
            role=Membership.Role.MEMBER,
            is_active=True,
        )
        current = household.memberships.select_for_update().get(user=request.user)
        household.owner = target.user
        household.save(update_fields=["owner", "updated_at"])
        current.role = Membership.Role.MEMBER
        current.save(update_fields=["role", "updated_at"])
        target.role = Membership.Role.OWNER
        target.save(update_fields=["role", "updated_at"])
        return Response({"status": "transferred", "owner": UserSerializer(target.user).data})


class LeaveHouseholdView(APIView):
    permission_classes = [HasHousehold]

    @extend_schema(request=None, responses={204: None})
    def post(self, request) -> Response:
        membership = user_membership(request.user)
        if membership.role == Membership.Role.OWNER:
            return Response(
                {"detail": "Transfer ownership before leaving the household."},
                status=status.HTTP_409_CONFLICT,
            )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    @extend_schema(request=None, responses={204: None})
    def delete(self, request) -> Response:
        membership = user_membership(request.user)
        if membership and membership.role == Membership.Role.OWNER:
            household = membership.household
            if household.memberships.filter(is_active=True).exclude(user=request.user).exists():
                return Response(
                    {"detail": "Transfer ownership before deleting this account."},
                    status=status.HTTP_409_CONFLICT,
                )
            household.delete()
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HouseholdScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsHouseholdOwner]

    def household(self) -> Household:
        return self.request.user.finance_membership.household

    def perform_create(self, serializer) -> None:
        serializer.save(household=self.household())


class RecurringIncomeViewSet(HouseholdScopedViewSet):
    queryset = RecurringIncome.objects.all()
    serializer_class = RecurringIncomeSerializer

    def get_queryset(self):
        household = user_household(self.request.user)
        return RecurringIncome.objects.filter(household=household) if household else []

    def perform_update(self, serializer) -> None:
        template = serializer.save()
        sync_recurring_income_to_latest_month(template)


class RecurringExpenseViewSet(HouseholdScopedViewSet):
    queryset = RecurringExpense.objects.all()
    serializer_class = RecurringExpenseSerializer

    def get_queryset(self):
        household = user_household(self.request.user)
        return RecurringExpense.objects.filter(household=household) if household else []

    def perform_update(self, serializer) -> None:
        template = serializer.save()
        sync_recurring_expense_to_latest_month(template)


class MonthViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = MonthlyPeriodSerializer
    permission_classes = [OwnerWriteMemberRead]

    def get_queryset(self):
        household = user_household(self.request.user)
        if not household:
            return MonthlyPeriod.objects.none()
        return (
            MonthlyPeriod.objects.filter(household=household, is_deleted=False)
            .prefetch_related(
                "income_plans__ledger_entries",
                "planned_expenses__ledger_entries",
            )
            .order_by("-year", "-month")
        )

    def perform_destroy(self, instance) -> None:
        delete_month(instance, self.request.user)

    @action(detail=False, methods=["get"])
    def current(self, request) -> Response:
        period = current_period(user_household(request.user))
        if period.is_deleted:
            period = self.get_queryset().first()
            if period is None:
                return Response(status=status.HTTP_404_NOT_FOUND)
        else:
            period = self.get_queryset().get(pk=period.pk)
        return Response(self.get_serializer(period).data)

    @action(detail=False, methods=["get"], url_path="by-label")
    def by_label(self, request) -> Response:
        label = request.query_params.get("month", "")
        try:
            year, month = (int(part) for part in label.split("-", maxsplit=1))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Use month=YYYY-MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = self.get_queryset().filter(year=year, month=month)
        period = queryset.first()
        if period is None and is_owner(request.user):
            generated = generate_month(user_household(request.user), year, month)
            if not generated.is_deleted:
                period = self.get_queryset().get(pk=generated.pk)
        if period is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(period).data)

    @extend_schema(
        request=MonthGenerateInputSerializer,
        responses={201: MonthlyPeriodSerializer},
    )
    @action(detail=False, methods=["post"], permission_classes=[IsHouseholdOwner])
    def generate(self, request) -> Response:
        year = int(request.data.get("year", date.today().year))
        month = int(request.data.get("month", date.today().month))
        if not 2000 <= year <= 2100 or not 1 <= month <= 12:
            return Response(
                {"detail": "Enter a valid year and month."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        rollover_data = None
        if "rollover" in request.data:
            rollover_serializer = MonthRolloverInputSerializer(data=request.data["rollover"])
            rollover_serializer.is_valid(raise_exception=True)
            rollover_data = rollover_serializer.validated_data
        try:
            with transaction.atomic():
                household = user_household(request.user)
                period = generate_month(
                    household,
                    year,
                    month,
                    restore_deleted=True,
                )
                if rollover_data is not None:
                    apply_month_rollovers(
                        household,
                        period,
                        request.user,
                        bill_allocations=rollover_data["bill_allocations"],
                        safe_to_spend=rollover_data.get("safe_to_spend"),
                    )
        except RolloverValidationError as exc:
            return Response({"rollover": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(period).data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["get"],
        url_path="rollover-preview",
        permission_classes=[IsHouseholdOwner],
    )
    @extend_schema(responses={200: RolloverPreviewSerializer})
    def rollover_preview(self, request) -> Response:
        try:
            year = int(request.query_params.get("year", ""))
            month = int(request.query_params.get("month", ""))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Enter a valid year and month."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not 2000 <= year <= 2100 or not 1 <= month <= 12:
            return Response(
                {"detail": "Enter a valid year and month."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(rollover_preview(user_household(request.user), year, month))

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None) -> Response:
        return Response(period_summary(self.get_object()))


class PlannedExpenseViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PlannedExpenseSerializer
    permission_classes = [OwnerWriteMemberRead]

    def get_queryset(self):
        household = user_household(self.request.user)
        if not household:
            return PlannedExpense.objects.none()
        queryset = PlannedExpense.objects.filter(period__household=household).prefetch_related(
            "ledger_entries"
        )
        period_id = self.request.query_params.get("period")
        return queryset.filter(period_id=period_id) if period_id else queryset

    def perform_update(self, serializer) -> None:
        planned = serializer.save()
        refresh_expense_carryovers(planned.period.household, planned.period)

    @action(detail=True, methods=["post"], permission_classes=[IsHouseholdOwner])
    def payments(self, request, pk=None) -> Response:
        planned = self.get_object()
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment_date = serializer.validated_data["date"]
        if (payment_date.year, payment_date.month) != (
            planned.period.year,
            planned.period.month,
        ):
            return Response(
                {"date": "Payment date must be inside the selected month."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry = LedgerEntry.objects.create(
            household=planned.period.household,
            period=planned.period,
            created_by=request.user,
            planned_expense=planned,
            entry_type=LedgerEntry.EntryType.HOUSEHOLD_EXPENSE,
            direction=LedgerEntry.Direction.DEBIT,
            date=payment_date,
            amount=serializer.validated_data["amount"],
            description=planned.name,
            notes=serializer.validated_data.get("notes", ""),
        )
        refresh_expense_carryovers(planned.period.household, planned.period)
        return Response(LedgerEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class IncomePlanViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [HasHousehold]

    def get_queryset(self):
        household = user_household(self.request.user)
        if not household:
            return MonthlyIncomePlan.objects.none()
        queryset = MonthlyIncomePlan.objects.filter(period__household=household).prefetch_related(
            "ledger_entries"
        )
        period_id = self.request.query_params.get("period")
        return queryset.filter(period_id=period_id) if period_id else queryset

    def get_serializer_class(self):
        from .serializers import MonthlyIncomePlanSerializer

        return MonthlyIncomePlanSerializer

    @action(detail=True, methods=["post"], permission_classes=[IsHouseholdOwner])
    def receive(self, request, pk=None) -> Response:
        planned = self.get_object()
        serializer = IncomeReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        receipt_date = serializer.validated_data["date"]
        if (receipt_date.year, receipt_date.month) != (
            planned.period.year,
            planned.period.month,
        ):
            return Response(
                {"date": "Income date must be inside the selected month."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry = LedgerEntry.objects.create(
            household=planned.period.household,
            period=planned.period,
            created_by=request.user,
            planned_income=planned,
            entry_type=LedgerEntry.EntryType.INCOME,
            direction=LedgerEntry.Direction.CREDIT,
            date=receipt_date,
            amount=serializer.validated_data["amount"],
            description=planned.name,
            notes=serializer.validated_data.get("notes", ""),
        )
        refresh_month_rollovers(planned.period.household, planned.period)
        return Response(LedgerEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class LedgerEntryViewSet(viewsets.ModelViewSet):
    serializer_class = LedgerEntrySerializer
    permission_classes = [IsHouseholdOwner]

    def get_queryset(self):
        household = user_household(self.request.user)
        if not household:
            return LedgerEntry.objects.none()
        queryset = LedgerEntry.objects.filter(household=household).exclude(
            entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE
        )
        period_id = self.request.query_params.get("period")
        return queryset.filter(period_id=period_id) if period_id else queryset

    def perform_create(self, serializer) -> None:
        entry = serializer.save(
            household=user_household(self.request.user),
            created_by=self.request.user,
        )
        if entry.entry_type == LedgerEntry.EntryType.HOUSEHOLD_EXPENSE:
            refresh_expense_carryovers(entry.household, entry.period)
        else:
            refresh_month_rollovers(entry.household, entry.period)

    def perform_update(self, serializer) -> None:
        entry = serializer.save()
        if entry.entry_type == LedgerEntry.EntryType.HOUSEHOLD_EXPENSE:
            refresh_expense_carryovers(entry.household, entry.period)
        else:
            refresh_month_rollovers(entry.household, entry.period)

    def perform_destroy(self, instance) -> None:
        household = instance.household
        period = instance.period
        is_household_payment = instance.entry_type == LedgerEntry.EntryType.HOUSEHOLD_EXPENSE
        instance.delete()
        if is_household_payment:
            refresh_expense_carryovers(household, period)
        else:
            refresh_month_rollovers(household, period)


class PersonalExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = PersonalExpenseSerializer
    permission_classes = [HasHousehold]

    def get_queryset(self):
        household = user_household(self.request.user)
        if not household:
            return LedgerEntry.objects.none()
        queryset = LedgerEntry.objects.filter(
            household=household,
            created_by=self.request.user,
            entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
        )
        period_id = self.request.query_params.get("period")
        return queryset.filter(period_id=period_id) if period_id else queryset

    def perform_create(self, serializer) -> None:
        entry = serializer.save(
            household=user_household(self.request.user),
            created_by=self.request.user,
            entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
            direction=LedgerEntry.Direction.DEBIT,
        )
        refresh_month_rollovers(entry.household, entry.period)

    def perform_update(self, serializer) -> None:
        entry = serializer.save()
        refresh_month_rollovers(entry.household, entry.period)

    def perform_destroy(self, instance) -> None:
        household = instance.household
        period = instance.period
        instance.delete()
        refresh_month_rollovers(household, period)


class SavingsGoalViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsGoalSerializer
    permission_classes = [OwnerWriteMemberRead]

    def get_queryset(self):
        household = user_household(self.request.user)
        return (
            SavingsGoal.objects.filter(household=household)
            if household
            else SavingsGoal.objects.none()
        )

    def perform_create(self, serializer) -> None:
        serializer.save(household=user_household(self.request.user))


class SavingsMovementViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsMovementSerializer
    permission_classes = [IsHouseholdOwner]

    def get_queryset(self):
        household = user_household(self.request.user)
        return (
            SavingsMovement.objects.filter(household=household)
            if household
            else SavingsMovement.objects.none()
        )

    def perform_create(self, serializer) -> None:
        movement = serializer.save(
            household=user_household(self.request.user),
            created_by=self.request.user,
        )
        if movement.period:
            refresh_month_rollovers(movement.household, movement.period)

    def perform_update(self, serializer) -> None:
        movement = serializer.save()
        if movement.period:
            refresh_month_rollovers(movement.household, movement.period)

    def perform_destroy(self, instance) -> None:
        if instance.kind == SavingsMovement.Kind.ALLOCATION:
            raise ValidationError(
                "Month rollover allocations can be changed only by editing their source month."
            )
        household = instance.household
        period = instance.period
        instance.delete()
        if period:
            refresh_month_rollovers(household, period)


class BankView(APIView):
    permission_classes = [HasHousehold]

    @extend_schema(responses={200: BankAccountSerializer})
    def get(self, request) -> Response:
        account = user_household(request.user).bank_account
        data = BankAccountSerializer(account).data
        data["calculated_balance"] = bank_calculated_balance(account)
        return Response(data)

    @extend_schema(request=BankAccountSerializer, responses={200: BankAccountSerializer})
    def patch(self, request) -> Response:
        if not is_owner(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        account = user_household(request.user).bank_account
        serializer = BankAccountSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(BankAccountSerializer(serializer.save()).data)


class ReconciliationView(APIView):
    permission_classes = [IsHouseholdOwner]

    @extend_schema(responses={200: BankReconciliationSerializer(many=True)})
    def get(self, request) -> Response:
        account = user_household(request.user).bank_account
        return Response(BankReconciliationSerializer(account.reconciliations.all(), many=True).data)

    @extend_schema(
        request=ReconciliationInputSerializer,
        responses={201: BankReconciliationSerializer},
    )
    def post(self, request) -> Response:
        serializer = ReconciliationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reconciliation = reconcile_bank(
            user_household(request.user).bank_account,
            request.user,
            reconciliation_date=serializer.validated_data["date"],
            actual_balance=serializer.validated_data["actual_balance"],
            notes=serializer.validated_data.get("notes", ""),
            post_adjustment=serializer.validated_data["post_adjustment"],
        )
        return Response(
            BankReconciliationSerializer(reconciliation).data,
            status=status.HTTP_201_CREATED,
        )


class DashboardView(APIView):
    permission_classes = [HasHousehold]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request) -> Response:
        household = user_household(request.user)
        label = request.query_params.get("month")
        if label:
            try:
                year, month = (int(part) for part in label.split("-", maxsplit=1))
                period = generate_month(household, year, month)
                if period.is_deleted:
                    return Response(status=status.HTTP_404_NOT_FOUND)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Use month=YYYY-MM."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            period = current_period(household)
            if period.is_deleted:
                period = household.periods.filter(is_deleted=False).first()
                if period is None:
                    return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(dashboard_data(household, period))


class TrendsView(APIView):
    permission_classes = [HasHousehold]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request) -> Response:
        return Response({"results": trends_data(user_household(request.user))})


class InvitationViewSet(viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    permission_classes = [IsHouseholdOwner]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        household = user_household(self.request.user)
        return (
            HouseholdInvitation.objects.filter(household=household)
            if household
            else HouseholdInvitation.objects.none()
        )

    def perform_destroy(self, instance) -> None:
        instance.status = HouseholdInvitation.Status.REVOKED
        instance.save(update_fields=["status", "updated_at"])

    def perform_create(self, serializer) -> None:
        invitation = serializer.save()
        if settings.EMAIL_ENABLED:
            invite_url = self.request.build_absolute_uri(f"/invite/{invitation.token}")
            send_mail(
                "You are invited to Finance Manager",
                f"Join {invitation.household.name}: {invite_url}",
                settings.DEFAULT_FROM_EMAIL,
                [invitation.email],
            )


class AcceptInvitationView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    def post(self, request, token) -> Response:
        invitation = get_object_or_404(
            HouseholdInvitation.objects.select_for_update(),
            token=token,
            status=HouseholdInvitation.Status.PENDING,
        )
        if invitation.is_expired:
            invitation.status = HouseholdInvitation.Status.EXPIRED
            invitation.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Invitation expired."}, status=status.HTTP_410_GONE)
        if request.user.email.casefold() != invitation.email.casefold():
            return Response(
                {"detail": "Sign in with the invited Google email address."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user_membership(request.user):
            return Response(
                {"detail": "This account already belongs to a household."},
                status=status.HTTP_409_CONFLICT,
            )
        Membership.objects.create(
            user=request.user,
            household=invitation.household,
            role=Membership.Role.MEMBER,
        )
        invitation.status = HouseholdInvitation.Status.ACCEPTED
        invitation.accepted_by = request.user
        invitation.save(update_fields=["status", "accepted_by", "updated_at"])
        return Response({"status": "accepted"})


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [HasHousehold]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None) -> Response:
        notification = self.get_object()
        if not notification.read_at:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"])
    def read_all(self, request) -> Response:
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class LedgerCsvExportView(APIView):
    permission_classes = [HasHousehold]

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.BINARY})
    def get(self, request) -> HttpResponse:
        household = user_household(request.user)
        entries = household.ledger_entries.select_related("created_by", "period")
        if not is_owner(request.user):
            entries = entries.filter(
                created_by=request.user,
                entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
            )
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="finance-manager-ledger.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "date",
                "month",
                "type",
                "direction",
                "amount",
                "description",
                "notes",
                "created_by",
            ]
        )
        for entry in entries:
            writer.writerow(
                [
                    entry.date.isoformat(),
                    entry.period.label,
                    entry.entry_type,
                    entry.direction,
                    entry.amount,
                    entry.description,
                    entry.notes,
                    entry.created_by.email if entry.created_by else "Former member",
                ]
            )
        if is_owner(request.user):
            audit_export(household, request.user, "ledger_csv")
        return response


class BackupExportView(APIView):
    permission_classes = [HasHousehold]

    @extend_schema(responses={(200, "application/json"): OpenApiTypes.OBJECT})
    def get(self, request) -> JsonResponse:
        household = user_household(request.user)
        owner_export = is_owner(request.user)
        entries = household.ledger_entries.select_related("created_by", "period")
        if not owner_export:
            entries = entries.filter(
                created_by=request.user,
                entry_type=LedgerEntry.EntryType.PERSONAL_EXPENSE,
            )
        payload: dict[str, Any] = {
            "schema_version": 2,
            "exported_at": timezone.now(),
            "scope": "full_household" if owner_export else "personal_only",
            "household": {
                "name": household.name,
                "currency": household.currency,
                "timezone": household.timezone,
                "monthly_savings_target": household.monthly_savings_target,
            },
            "ledger_entries": [
                {
                    "date": entry.date,
                    "period": entry.period.label,
                    "type": entry.entry_type,
                    "direction": entry.direction,
                    "amount": entry.amount,
                    "description": entry.description,
                    "notes": entry.notes,
                    "created_by": entry.created_by.email if entry.created_by else None,
                }
                for entry in entries
            ],
        }
        if owner_export:
            payload.update(
                {
                    "bank_account": BankAccountSerializer(household.bank_account).data,
                    "income_templates": RecurringIncomeSerializer(
                        household.income_templates.all(), many=True
                    ).data,
                    "expense_templates": RecurringExpenseSerializer(
                        household.expense_templates.all(), many=True
                    ).data,
                    "periods": [
                        period_summary(period)
                        for period in household.periods.filter(is_deleted=False)
                    ],
                    "savings_goals": SavingsGoalSerializer(
                        household.savings_goals.all(), many=True
                    ).data,
                    "savings_movements": SavingsMovementSerializer(
                        household.savings_movements.all(), many=True
                    ).data,
                    "rollover_allocations": RolloverAllocationSerializer(
                        household.rollover_allocations.all(), many=True
                    ).data,
                    "reconciliations": BankReconciliationSerializer(
                        household.bank_account.reconciliations.all(), many=True
                    ).data,
                }
            )
            audit_export(household, request.user, "full_json")
        response = JsonResponse(payload, encoder=DjangoJSONEncoder)
        response["Content-Disposition"] = 'attachment; filename="finance-manager-backup.json"'
        return response
