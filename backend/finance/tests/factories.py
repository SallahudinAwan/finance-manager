from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model

from finance.models import BankAccount, Household, Membership


def create_household(email: str = "owner@example.com"):
    user = get_user_model().objects.create_user(
        username=email,
        email=email,
        first_name="Owner",
    )
    household = Household.objects.create(
        name="Test Home",
        owner=user,
        monthly_savings_target=Decimal("150000.00"),
        onboarding_complete=True,
    )
    Membership.objects.create(
        user=user,
        household=household,
        role=Membership.Role.OWNER,
    )
    BankAccount.objects.create(
        household=household,
        name="Main Bank",
        opening_balance=Decimal("329980.00"),
        opening_date=date(2026, 8, 1),
    )
    return user, household


def create_member(household, email: str = "member@example.com"):
    user = get_user_model().objects.create_user(username=email, email=email)
    Membership.objects.create(
        user=user,
        household=household,
        role=Membership.Role.MEMBER,
    )
    return user
