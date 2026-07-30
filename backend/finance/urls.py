from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AcceptInvitationView,
    BackupExportView,
    BankView,
    DashboardView,
    DeleteAccountView,
    HealthDetailView,
    HouseholdMembersView,
    HouseholdView,
    IncomePlanViewSet,
    InvitationViewSet,
    LeaveHouseholdView,
    LedgerCsvExportView,
    LedgerEntryViewSet,
    MonthViewSet,
    NotificationViewSet,
    OnboardingView,
    PersonalExpenseViewSet,
    PlannedExpenseViewSet,
    ReconciliationView,
    RecurringExpenseViewSet,
    RecurringIncomeViewSet,
    SavingsGoalViewSet,
    SavingsMovementViewSet,
    SessionView,
    TransferOwnershipView,
    TrendsView,
    UserPreferenceView,
)

router = DefaultRouter()
router.register("income-templates", RecurringIncomeViewSet, basename="income-template")
router.register("expense-templates", RecurringExpenseViewSet, basename="expense-template")
router.register("months", MonthViewSet, basename="month")
router.register("income-plans", IncomePlanViewSet, basename="income-plan")
router.register("planned-expenses", PlannedExpenseViewSet, basename="planned-expense")
router.register("ledger", LedgerEntryViewSet, basename="ledger")
router.register("personal-expenses", PersonalExpenseViewSet, basename="personal-expense")
router.register("savings-goals", SavingsGoalViewSet, basename="savings-goal")
router.register("savings-movements", SavingsMovementViewSet, basename="savings-movement")
router.register("invitations", InvitationViewSet, basename="invitation")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", HealthDetailView.as_view(), name="health-detail"),
    path("session/", SessionView.as_view(), name="session"),
    path("preferences/", UserPreferenceView.as_view(), name="user-preferences"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("household/", HouseholdView.as_view(), name="household"),
    path("household/members/", HouseholdMembersView.as_view(), name="household-members"),
    path(
        "household/transfer-ownership/",
        TransferOwnershipView.as_view(),
        name="transfer-ownership",
    ),
    path("household/leave/", LeaveHouseholdView.as_view(), name="leave-household"),
    path("account/", DeleteAccountView.as_view(), name="delete-account"),
    path("bank/", BankView.as_view(), name="bank"),
    path("bank/reconciliations/", ReconciliationView.as_view(), name="reconciliations"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reports/trends/", TrendsView.as_view(), name="trends"),
    path(
        "invitations/<uuid:token>/accept/",
        AcceptInvitationView.as_view(),
        name="accept-invitation",
    ),
    path("exports/ledger.csv", LedgerCsvExportView.as_view(), name="ledger-export"),
    path("exports/backup.json", BackupExportView.as_view(), name="backup-export"),
]
