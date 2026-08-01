from django.contrib import admin

from . import models

for model in (
    models.Household,
    models.Membership,
    models.HouseholdInvitation,
    models.BankAccount,
    models.RecurringIncome,
    models.RecurringExpense,
    models.MonthlyPeriod,
    models.MonthlyIncomePlan,
    models.PlannedExpense,
    models.LedgerEntry,
    models.SavingsGoal,
    models.RolloverAllocation,
    models.SavingsMovement,
    models.BankReconciliation,
    models.Notification,
    models.ReminderDelivery,
    models.AuditEvent,
):
    admin.site.register(model)
