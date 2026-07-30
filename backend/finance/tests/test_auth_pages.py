import pytest
from django.test import Client

from finance.tests.factories import create_household

pytestmark = pytest.mark.django_db


def test_logout_page_uses_branded_confirmation_template() -> None:
    owner, _ = create_household()
    client = Client()
    client.force_login(owner)

    response = client.get("/accounts/logout/")

    assert response.status_code == 200
    assert b"Sign out of Finance Manager?" in response.content
    assert b"Sign out securely" in response.content
    assert owner.email.encode() in response.content
    assert b"Account Connections" not in response.content
