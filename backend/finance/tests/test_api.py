from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from finance.models import (
    HouseholdInvitation,
    LedgerEntry,
    Membership,
    RecurringExpense,
    SavingsGoal,
)
from finance.services import generate_month
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
